package com.skillmatch.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.skillmatch.backend.config.JwtProperties;
import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ApplicationStatus;
import com.skillmatch.backend.model.AvisoEnviado;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.JobStatus;
import com.skillmatch.backend.model.Message;
import com.skillmatch.backend.model.PreferenciasCorreo;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.AvisoEnviadoRepository;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.JobRepository;
import com.skillmatch.backend.repository.PreferenciasCorreoRepository;
import com.skillmatch.backend.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

/**
 * Los correos y la campanita del PDF ("Correos y avisos"):
 *
 *  1. La empresa respondio tu postulacion: campanita siempre y correo si la persona lo quiere.
 *     Si fue rechazada y el modelo ya le gana al modelo flojo, el correo trae el consejo.
 *  2. Tienes un mensaje sin leer: si lleva mas de 2 horas sin leer. Como maximo uno al dia por conversacion.
 *  3. Vacantes nuevas para ti (opcional, apagado al empezar): los lunes a las 8, las 3 que mas se parecen.
 *  4. Un candidato se postulo (empresas): un resumen al dia, a las 7 p. m., no un correo por persona.
 *
 * Cada correo trae un enlace para dejar de recibir ese tipo (sin iniciar sesion, firmado con HMAC).
 * Tope diario de envios (Gmail gratis permite unos 500 al dia): al llegar, se deja para el dia siguiente.
 * Texto plano, con CorreoService (el mismo de los codigos de verificacion).
 */
@Slf4j
@Service
@SuppressWarnings("null")
public class AvisosCorreoService {

    private static final ZoneId BOGOTA = ZoneId.of("America/Bogota");

    private final CorreoService correoService;
    private final NotificationService notificationService;
    private final ModeloPredictivoService modeloService;
    private final PreferenciasCorreoRepository preferenciasRepository;
    private final AvisoEnviadoRepository avisosRepository;
    private final UserRepository userRepository;
    private final JobRepository jobRepository;
    private final CompanyRepository companyRepository;
    private final MongoTemplate mongoTemplate;
    private final byte[] llave;
    private final String sitio;
    private final int maximoAlDia;

    private final AtomicInteger enviadosHoy = new AtomicInteger();
    private volatile LocalDate dia = LocalDate.now(BOGOTA);

    public AvisosCorreoService(CorreoService correoService, NotificationService notificationService,
                               ModeloPredictivoService modeloService, PreferenciasCorreoRepository preferenciasRepository,
                               AvisoEnviadoRepository avisosRepository, UserRepository userRepository,
                               JobRepository jobRepository, CompanyRepository companyRepository,
                               MongoTemplate mongoTemplate, JwtProperties jwtProperties,
                               @Value("${app.sitio:https://skillmatch-yz37.onrender.com}") String sitio,
                               @Value("${app.correo.maximo-al-dia:400}") int maximoAlDia) {
        this.correoService = correoService;
        this.notificationService = notificationService;
        this.modeloService = modeloService;
        this.preferenciasRepository = preferenciasRepository;
        this.avisosRepository = avisosRepository;
        this.userRepository = userRepository;
        this.jobRepository = jobRepository;
        this.companyRepository = companyRepository;
        this.mongoTemplate = mongoTemplate;
        // La llave de los enlaces de baja sale del secreto del JWT (nunca se escribe en el codigo)
        this.llave = ("baja-correos:" + jwtProperties.getSecret()).getBytes(StandardCharsets.UTF_8);
        this.sitio = sitio.endsWith("/") ? sitio.substring(0, sitio.length() - 1) : sitio;
        this.maximoAlDia = maximoAlDia;
    }

    // ---------------------------------------------------------------- preferencias

    public PreferenciasCorreo preferencias(String userId) {
        return preferenciasRepository.findById(userId).orElseGet(() -> new PreferenciasCorreo(userId));
    }

    public PreferenciasCorreo cambiar(String userId, Map<String, Boolean> cambios) {
        PreferenciasCorreo p = preferencias(userId);
        cambios.forEach((tipo, valor) -> { if (valor != null) p.poner(tipo, valor); });
        return preferenciasRepository.save(p);
    }

    /** Enlace de baja: /api/public/correos/baja?u=...&k=tipo&t=firma */
    String enlaceDeBaja(String userId, String tipo) {
        return sitio + "/api/public/correos/baja?u=" + userId + "&k=" + tipo + "&t=" + firma(userId, tipo);
    }

    String firma(String userId, String tipo) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(llave, "HmacSHA256"));
            byte[] h = mac.doFinal((userId + ":" + tipo).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(h);
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Apaga un tipo de correo desde el enlace del correo. Devuelve false si la firma no coincide. */
    public boolean darseDeBaja(String userId, String tipo, String token) {
        if (userId == null || tipo == null || token == null) return false;
        boolean valida = MessageDigest.isEqual(firma(userId, tipo).getBytes(StandardCharsets.UTF_8),
                token.getBytes(StandardCharsets.UTF_8));
        if (!valida || !userRepository.existsById(userId)) return false;
        PreferenciasCorreo p = preferencias(userId);
        p.poner(tipo, false);
        preferenciasRepository.save(p);
        return true;
    }

    // ---------------------------------------------------------------- 1. respuesta de la empresa

    /** Lo llama ApplicationService.updateStatus cuando la postulacion pasa a aceptada o rechazada. */
    public void postulacionRespondida(Application a, Job vacante) {
        boolean aceptada = a.getStatus() == ApplicationStatus.ACEPTADA;
        String titulo = vacante == null || vacante.getTitle() == null ? "una vacante" : vacante.getTitle();
        String enlace = "/pages/perfil-usuario.html?tab=applications&postulacion=" + a.getId();
        notificationService.createNotification(a.getUserId(), "application_update",
                (aceptada ? "Te aceptaron en " : "La empresa respondió tu postulación a ") + titulo,
                a.getId(), enlace);

        User u = userRepository.findById(a.getUserId()).orElse(null);
        if (u == null || !quiere(u.getId(), PreferenciasCorreo.RESPUESTA)) return;
        StringBuilder t = new StringBuilder("Hola").append(nombre(u)).append(",\n\n");
        if (aceptada) {
            t.append("Buenas noticias: la empresa aceptó tu postulación a \"").append(titulo)
             .append("\". Revisa tus mensajes en SkillMatch para los siguientes pasos.");
        } else {
            t.append("La empresa respondió tu postulación a \"").append(titulo)
             .append("\": esta vez no siguió adelante.");
            String consejo = consejoSeguro(a);
            if (!consejo.isEmpty()) t.append("\n\nUn consejo para la próxima: ").append(consejo);
            t.append("\n\nSigue intentando: hay vacantes nuevas cada semana.");
        }
        t.append("\n\nVer la postulación: ").append(sitio).append(enlace);
        enviar(u, PreferenciasCorreo.RESPUESTA,
                aceptada ? "Te aceptaron en " + titulo : "Respuesta a tu postulación: " + titulo, t);
    }

    private String consejoSeguro(Application a) {
        try {
            return modeloService.consejoPara(a);
        } catch (RuntimeException e) {
            log.warn("No se pudo calcular el consejo para la postulación {}: {}", a.getId(), e.getMessage());
            return "";
        }
    }

    // ---------------------------------------------------------------- 2. mensajes sin leer

    @Scheduled(cron = "0 */30 * * * *", zone = "America/Bogota")
    public void mensajesSinLeer() {
        LocalDateTime ahora = LocalDateTime.now();
        Query q = new Query(Criteria.where("isRead").is(false).and("deletedByReceiver").ne(true)
                .and("sentAt").lt(ahora.minusHours(2)).gt(ahora.minusDays(3)));
        q.fields().include("senderId", "receiverId");
        Map<String, Set<String>> porPersona = new LinkedHashMap<>();
        for (Message m : mongoTemplate.find(q, Message.class)) {
            porPersona.computeIfAbsent(m.getReceiverId(), k -> new HashSet<>()).add(m.getSenderId());
        }
        porPersona.forEach((receptor, remitentes) -> {
            if (!quiere(receptor, PreferenciasCorreo.MENSAJES)) return;
            User u = userRepository.findById(receptor).orElse(null);
            if (u == null) return;
            for (String remitente : remitentes) {
                if (yaSeAviso(receptor, PreferenciasCorreo.MENSAJES, remitente, ahora.minusDays(1))) continue;
                String quien = userRepository.findById(remitente).map(this::nombre).orElse("Alguien");
                StringBuilder t = new StringBuilder("Hola").append(nombre(u)).append(",\n\n")
                        .append(quien).append(" te escribió en SkillMatch y todavía no has leído el mensaje.")
                        .append("\n\nLeerlo: ").append(sitio).append("/pages/mensajes.html?userId=").append(remitente);
                if (enviar(u, PreferenciasCorreo.MENSAJES, "Tienes un mensaje sin leer", t)) {
                    registrar(receptor, PreferenciasCorreo.MENSAJES, remitente);
                }
            }
        });
    }

    // ---------------------------------------------------------------- 3. vacantes nuevas (opcional)

    @Scheduled(cron = "0 0 8 * * MON", zone = "America/Bogota")
    public void vacantesNuevas() {
        List<Job> nuevas = mongoTemplate.find(new Query(Criteria.where("active").is(true)
                .and("status").is(JobStatus.ABIERTA).and("postedDate").gt(LocalDateTime.now().minusDays(7))), Job.class);
        if (nuevas.isEmpty()) return;
        String semana = LocalDate.now(BOGOTA).toString();
        for (PreferenciasCorreo p : mongoTemplate.find(new Query(Criteria.where("vacantes").is(true)), PreferenciasCorreo.class)) {
            User u = userRepository.findById(p.getUserId()).orElse(null);
            if (u == null || u.getSkills() == null || u.getSkills().isEmpty()) continue;
            if (yaSeAviso(u.getId(), PreferenciasCorreo.VACANTES, semana, LocalDateTime.now().minusDays(6))) continue;
            Set<String> suyas = u.getSkills().stream().map(s -> norm(s.getName())).collect(Collectors.toSet());
            List<Job> top = nuevas.stream()
                    .filter(v -> coinciden(v, suyas) > 0)
                    .sorted(Comparator.comparingLong((Job v) -> coinciden(v, suyas)).reversed())
                    .limit(3).toList();
            if (top.isEmpty()) continue;
            StringBuilder t = new StringBuilder("Hola").append(nombre(u))
                    .append(",\n\nEstas vacantes nuevas piden habilidades que tú tienes:\n");
            for (Job v : top) {
                t.append("\n- ").append(v.getTitle()).append(": ").append(sitio)
                 .append("/pages/oportunidades.html?jobId=").append(v.getId());
            }
            if (enviar(u, PreferenciasCorreo.VACANTES, "Vacantes nuevas para ti", t)) {
                registrar(u.getId(), PreferenciasCorreo.VACANTES, semana);
            }
        }
    }

    private static long coinciden(Job v, Set<String> suyas) {
        return v.getSkills() == null ? 0 : v.getSkills().stream().map(AvisosCorreoService::norm).distinct()
                .filter(suyas::contains).count();
    }

    // ---------------------------------------------------------------- 4. postulaciones recibidas (empresas)

    @Scheduled(cron = "0 0 19 * * *", zone = "America/Bogota")
    public void resumenDePostulaciones() {
        String hoy = LocalDate.now(BOGOTA).toString();
        List<Application> recientes = mongoTemplate.find(new Query(Criteria.where("appliedDate")
                .gt(LocalDateTime.now().minusDays(1))), Application.class);
        Map<String, Long> porVacante = recientes.stream()
                .collect(Collectors.groupingBy(Application::getJobId, LinkedHashMap::new, Collectors.counting()));
        Map<String, Map<String, Long>> porEmpresa = new LinkedHashMap<>();
        porVacante.forEach((jobId, n) -> jobRepository.findById(jobId).ifPresent(v ->
                porEmpresa.computeIfAbsent(v.getCompanyId(), k -> new LinkedHashMap<>())
                        .merge(v.getTitle() == null ? "Vacante" : v.getTitle(), n, Long::sum)));
        porEmpresa.forEach((companyId, vacantes) -> {
            Company c = companyRepository.findById(companyId).orElse(null);
            if (c == null || c.getUserId() == null) return;
            User cuenta = userRepository.findById(c.getUserId()).orElse(null);
            if (cuenta == null || !quiere(cuenta.getId(), PreferenciasCorreo.POSTULACIONES)) return;
            if (yaSeAviso(cuenta.getId(), PreferenciasCorreo.POSTULACIONES, hoy, LocalDateTime.now().minusHours(20))) return;
            long total = vacantes.values().stream().mapToLong(Long::longValue).sum();
            StringBuilder t = new StringBuilder("Hola, ").append(c.getName() == null ? "" : c.getName())
                    .append("\n\nHoy recibiste ").append(total).append(total == 1 ? " postulación nueva:" : " postulaciones nuevas:");
            vacantes.forEach((titulo, n) -> t.append("\n- ").append(titulo).append(": ").append(n));
            t.append("\n\nVerlas: ").append(sitio).append("/pages/perfil-empresa.html?tab=applicants");
            String para = c.getEmail() != null && !c.getEmail().isBlank() ? c.getEmail() : cuenta.getEmail();
            if (enviar(cuenta, para, PreferenciasCorreo.POSTULACIONES,
                    total == 1 ? "Un candidato se postuló" : total + " candidatos se postularon", t)) {
                registrar(cuenta.getId(), PreferenciasCorreo.POSTULACIONES, hoy);
            }
        });
    }

    // ---------------------------------------------------------------- comunes

    private boolean quiere(String userId, String tipo) {
        return preferencias(userId).quiere(tipo);
    }

    private boolean yaSeAviso(String userId, String tipo, String clave, LocalDateTime desde) {
        return avisosRepository.existsByUserIdAndTipoAndClaveAndFechaAfter(userId, tipo, clave, desde);
    }

    private void registrar(String userId, String tipo, String clave) {
        avisosRepository.save(new AvisoEnviado(null, userId, tipo, clave, LocalDateTime.now()));
    }

    private boolean enviar(User u, String tipo, String asunto, StringBuilder texto) {
        return enviar(u, u.getEmail(), tipo, asunto, texto);
    }

    private boolean enviar(User u, String para, String tipo, String asunto, StringBuilder texto) {
        if (para == null || para.isBlank()) return false;      // cuentas creadas solo con telefono
        if (!cupoDisponible()) {
            log.warn("Tope diario de correos automaticos alcanzado ({}): '{}' queda para despues", maximoAlDia, asunto);
            return false;
        }
        texto.append("\n\n¿No quieres recibir este tipo de correo? ").append(enlaceDeBaja(u.getId(), tipo))
             .append("\nTambién puedes elegir tus correos en tu perfil, en \"Correos que recibo\".");
        return correoService.enviar(para, asunto, texto.toString());
    }

    private synchronized boolean cupoDisponible() {
        LocalDate hoy = LocalDate.now(BOGOTA);
        if (!hoy.equals(dia)) { dia = hoy; enviadosHoy.set(0); }
        return enviadosHoy.incrementAndGet() <= maximoAlDia;
    }

    private String nombre(User u) {
        return u.getFirstName() == null || u.getFirstName().isBlank() ? "" : " " + u.getFirstName().trim();
    }

    private static String norm(String s) {
        return s == null ? "" : java.text.Normalizer.normalize(s.trim().toLowerCase(Locale.ROOT), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }
}
