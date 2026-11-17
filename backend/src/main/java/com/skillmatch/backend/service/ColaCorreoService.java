package com.skillmatch.backend.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.skillmatch.backend.model.CorreoPendiente;

import lombok.extern.slf4j.Slf4j;

/**
 * El tope diario de correos automaticos de TODO el sistema y lo que pasa al llegar a el.
 *
 * Gmail gratis permite unos 500 envios al dia. Se reservan 100 para lo que no puede esperar y no
 * pasa por aqui (codigos de verificacion, recuperacion de clave, avisos de seguridad); los otros
 * 400 se reparten asi (el contador se guarda en MongoDB: no se reinicia al reiniciar el servidor):
 *
 *   ALTA  hasta el 100 % del tope: la invitacion a la siguiente etapa y la respuesta a una postulacion
 *   MEDIA hasta el  85 %: recordatorios (plan Profesional) y el resumen diario de las empresas
 *   BAJA  hasta el  70 %: mensajes sin leer y vacantes nuevas
 *
 * Asi, un dia de mucho movimiento nunca deja a una invitacion sin salir por culpa de correos de
 * menor importancia. Al llegar al tope, el correo no se pierde: queda en la cola (coleccion
 * correos_pendientes) y sale en cuanto haya cupo (cada 10 minutos, primero los mas importantes).
 * Si vence antes de salir, se descarta, se cuenta y queda en el registro. La campanita dentro de
 * SkillMatch siempre se crea al momento, con o sin correo.
 */
@Slf4j
@Service
public class ColaCorreoService {

    public enum Prioridad {
        ALTA(1, 100), MEDIA(2, 85), BAJA(3, 70);
        final int orden;
        final int porcentajeDelTope;
        Prioridad(int orden, int porcentajeDelTope) { this.orden = orden; this.porcentajeDelTope = porcentajeDelTope; }
    }

    public enum Resultado { ENVIADO, EN_COLA, NO_ENVIADO }

    static final String CONTADOR = "correos_contador";
    private static final ZoneId BOGOTA = ZoneId.of("America/Bogota");
    private static final int INTENTOS_MAXIMOS = 3;

    private final CorreoService correo;
    private final MongoTemplate mongo;
    private final int maximoAlDia;

    public ColaCorreoService(CorreoService correo, MongoTemplate mongo,
                             @Value("${app.correo.maximo-al-dia:400}") int maximoAlDia) {
        this.correo = correo;
        this.mongo = mongo;
        this.maximoAlDia = maximoAlDia;
    }

    /** Envia ahora si hay cupo para esa prioridad; si no, lo deja en la cola hasta que venza su vigencia. */
    public Resultado enviar(String para, String asunto, String texto, Prioridad prioridad, Duration vigencia) {
        if (para == null || para.isBlank()) return Resultado.NO_ENVIADO;
        if (!tomarCupo(prioridad)) {
            encolar(para, asunto, texto, prioridad, vigencia, 0);
            log.warn("Tope diario de correos ({}) alcanzado para prioridad {}: '{}' queda en cola", maximoAlDia, prioridad, asunto);
            return Resultado.EN_COLA;
        }
        if (correo.enviar(para, asunto, texto)) return Resultado.ENVIADO;
        devolverCupo();
        if (!correo.configurado()) return Resultado.NO_ENVIADO;     // sin servicio de correo no hay nada que reintentar
        encolar(para, asunto, texto, prioridad, vigencia, 1);
        log.warn("El envio de '{}' fallo: queda en cola para reintentar", asunto);
        return Resultado.EN_COLA;
    }

    /** Cada 10 minutos: saca de la cola lo que quepa, lo mas importante primero. */
    @Scheduled(cron = "${skillmatch.correos.cron.cola:0 */10 * * * *}", zone = "America/Bogota")
    public synchronized int vaciarCola() {
        int enviados = 0;
        for (CorreoPendiente p : siguientes(200)) {
            if (p.getVence() != null && p.getVence().isBefore(LocalDateTime.now())) {
                quitar(p);
                contarDescartado();
                log.warn("Correo '{}' descartado: venció esperando cupo del día ({})", p.getAsunto(), p.getPrioridad());
                continue;
            }
            Prioridad pr = Prioridad.valueOf(p.getPrioridad());
            if (!tomarCupo(pr)) break;      // la cola va de mas a menos importante: si este no cabe, los siguientes tampoco
            if (correo.enviar(p.getPara(), p.getAsunto(), p.getTexto())) {
                quitar(p);
                enviados++;
            } else {
                devolverCupo();
                p.setIntentos(p.getIntentos() + 1);
                if (p.getIntentos() >= INTENTOS_MAXIMOS) {
                    quitar(p);
                    contarDescartado();
                    log.error("Correo '{}' descartado tras {} intentos fallidos", p.getAsunto(), INTENTOS_MAXIMOS);
                } else {
                    actualizar(p);
                }
            }
        }
        if (enviados > 0) log.info("Cola de correos: {} enviados", enviados);
        return enviados;
    }

    /** Para la pagina de administracion. */
    public Map<String, Object> estado() {
        Document d = contadorDeHoy();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("enviadosHoy", d == null ? 0 : numero(d, "enviados"));
        m.put("descartadosHoy", d == null ? 0 : numero(d, "descartados"));
        m.put("topeDiario", maximoAlDia);
        m.put("pendientes", contarPendientes());
        m.put("reservadoParaCodigos", 100);
        return m;
    }

    // ------------------------------------------------------------------ almacenamiento (se sustituye en las pruebas)

    int limite(Prioridad p) { return maximoAlDia * p.porcentajeDelTope / 100; }

    boolean tomarCupo(Prioridad p) {
        Document d = mongo.findAndModify(Query.query(Criteria.where("_id").is(hoy())), new Update().inc("enviados", 1),
                FindAndModifyOptions.options().upsert(true).returnNew(true), Document.class, CONTADOR);
        if (d != null && numero(d, "enviados") <= limite(p)) return true;
        devolverCupo();
        return false;
    }

    void devolverCupo() {
        mongo.updateFirst(Query.query(Criteria.where("_id").is(hoy())), new Update().inc("enviados", -1), CONTADOR);
    }

    void contarDescartado() {
        mongo.upsert(Query.query(Criteria.where("_id").is(hoy())), new Update().inc("descartados", 1), CONTADOR);
    }

    Document contadorDeHoy() {
        return mongo.findById(hoy(), Document.class, CONTADOR);
    }

    void encolar(String para, String asunto, String texto, Prioridad prioridad, Duration vigencia, int intentos) {
        CorreoPendiente p = new CorreoPendiente();
        p.setPara(para);
        p.setAsunto(asunto);
        p.setTexto(texto);
        p.setPrioridad(prioridad.name());
        p.setOrden(prioridad.orden);
        p.setIntentos(intentos);
        p.setCreatedAt(LocalDateTime.now());
        p.setVence(LocalDateTime.now().plus(vigencia));
        mongo.save(p);
    }

    List<CorreoPendiente> siguientes(int n) {
        return mongo.find(new Query().with(Sort.by("orden", "createdAt")).limit(n), CorreoPendiente.class);
    }

    void quitar(CorreoPendiente p) { mongo.remove(p); }

    void actualizar(CorreoPendiente p) { mongo.save(p); }

    long contarPendientes() { return mongo.count(new Query(), CorreoPendiente.class); }

    private static String hoy() { return LocalDate.now(BOGOTA).toString(); }

    private static int numero(Document d, String campo) {
        Object v = d.get(campo);
        return v instanceof Number n ? n.intValue() : 0;
    }
}
