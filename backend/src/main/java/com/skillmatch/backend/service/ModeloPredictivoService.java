package com.skillmatch.backend.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ModeloVersion;
import com.skillmatch.backend.modelo.EntrenadorModelo;
import com.skillmatch.backend.repository.ModeloVersionRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * El modelo predictivo dentro del servidor (PDF, pasos 3 y 4).
 *
 * - Cada noche a las 3:30 a. m. (hora de Colombia) vuelve a aprender con todas las postulaciones
 *   respondidas y guarda la version con su nota en la coleccion "modelo_versiones".
 * - La pagina "Como aprende SkillMatch" y el recuadro de "Mis postulaciones" leen la ultima
 *   version en GET /api/public/modelo (solo cifras de todos juntos, nunca de una persona).
 * - Si todavia no hay ninguna version (primer arranque) o la ultima tiene mas de 26 horas (el servidor
 *   estaba dormido a la hora de aprender), aprende en ese momento.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ModeloPredictivoService {

    private final TablaEjemplosService tablaEjemplosService;
    private final ModeloVersionRepository versionRepository;

    /** PDF: "¿Dejamos fuera las vacantes (ejemplo)?" Hoy no, porque son todos los datos (variable MODELO_SIN_EJEMPLOS). */
    @Value("${skillmatch.modelo.excluir-ejemplos:${MODELO_SIN_EJEMPLOS:false}}")
    private boolean excluirEjemplos;

    private volatile Map<String, Object> enMemoria;

    @Scheduled(cron = "0 30 3 * * *", zone = "America/Bogota")
    public void aprenderCadaNoche() {
        try {
            Map<String, Object> m = aprender();
            log.info("Modelo predictivo: aprendio con {} respondidas (estado {})",
                    ((Map<?, ?>) m.get("datos")).get("respondidas"), m.get("estado"));
        } catch (RuntimeException e) {
            log.error("Modelo predictivo: no pudo aprender esta noche", e);
        }
    }

    /** Vuelve a aprender ahora y guarda la version. */
    public synchronized Map<String, Object> aprender() {
        Map<String, Object> m = EntrenadorModelo.entrenar(tablaEjemplosService.filas(),
                tablaEjemplosService.habilidadesDeVacantes(), "plataforma", excluirEjemplos);
        ModeloVersion v = new ModeloVersion();
        v.setFecha(LocalDateTime.now(ZoneId.of("America/Bogota")));
        v.setRespondidas((Integer) ((Map<?, ?>) m.get("datos")).get("respondidas"));
        v.setEstado((String) m.get("estado"));
        if ("listo".equals(m.get("estado"))) {
            Map<?, ?> modelos = (Map<?, ?>) ((Map<?, ?>) m.get("examen")).get("modelos");
            v.setExactitudArbol((Double) ((Map<?, ?>) modelos.get("arbol")).get("exactitud"));
            v.setExactitudFlojo((Double) ((Map<?, ?>) modelos.get("flojo")).get("exactitud"));
        }
        v.setModelo(m);
        versionRepository.save(v);
        enMemoria = null;
        return actual();
    }

    /** La ultima version, con el historial de notas (una por dia, de la mas vieja a la mas nueva). */
    public Map<String, Object> actual() {
        Map<String, Object> m = enMemoria;
        if (m != null) return m;
        synchronized (this) {
            if (enMemoria != null) return enMemoria;
            ModeloVersion ultima = versionRepository.findTopByOrderByFechaDesc().orElse(null);
            // Primer arranque, o el servidor estaba dormido a las 3:30 (Render Free se duerme sin visitas):
            // aprende ahora para que no se pierda la noche. Con cientos de postulaciones tarda menos de un segundo.
            if (ultima == null || ultima.getFecha() == null
                    || ultima.getFecha().isBefore(LocalDateTime.now(ZoneId.of("America/Bogota")).minusHours(26))) {
                return aprender();
            }
            Map<String, Object> copia = new LinkedHashMap<>(ultima.getModelo());
            copia.put("historial", historial());
            enMemoria = copia;
            return copia;
        }
    }

    /** Para la parte 8 de la pagina: la nota de cada noche (la ultima de cada dia, hasta 60 dias). */
    List<Map<String, Object>> historial() {
        Set<LocalDate> vistos = new LinkedHashSet<>();
        List<Map<String, Object>> salida = new ArrayList<>();
        for (ModeloVersion v : versionRepository.notas()) {            // de la mas nueva a la mas vieja
            if (v.getFecha() == null || !vistos.add(v.getFecha().toLocalDate()) || !"listo".equals(v.getEstado())) continue;
            Map<String, Object> h = new LinkedHashMap<>();
            h.put("fecha", v.getFecha().toLocalDate().toString());
            h.put("respondidas", v.getRespondidas());
            h.put("exactitud_arbol", v.getExactitudArbol());
            h.put("exactitud_flojo", v.getExactitudFlojo());
            salida.add(0, h);
            if (salida.size() == 60) break;
        }
        return salida;
    }

    /** Lo que la persona puede mejorar (igual que ACCIONABLES en modelo-predictivo.js). */
    private static final List<String> ACCIONABLES = List.of("pct_habilidades", "nivel_dominio", "anos_experiencia",
            "alcanza_experiencia", "num_estudios", "perfil_completo", "tiene_carta", "palabras_carta");

    /**
     * El consejo para el correo de "rechazada" (PDF: "con el consejo si fue rechazada").
     * Misma regla que consejoDe() en modelo-predictivo.js: en el camino del arbol, la pregunta de algo
     * que la persona puede mejorar donde tomo la rama con menos aceptadas. Vacio si el modelo
     * todavia no le gana al modelo flojo (dar_consejos = false) o no hay nada que sugerir.
     */
    @SuppressWarnings("unchecked")
    public String consejoPara(Application a) {
        Map<String, Object> m = actual();
        if (!"listo".equals(m.get("estado")) || !Boolean.TRUE.equals(m.get("dar_consejos"))) return "";
        Map<String, Object> p = tablaEjemplosService.unaPostulacion(a, null);
        if (p == null) return "";
        Map<String, Number> x = (Map<String, Number>) p.get("caracteristicas");
        List<Map<String, Object>> arbol = (List<Map<String, Object>>) m.get("arbol");
        Map<String, Object> nodo = arbol.get(0);
        String frase = null, variable = null;
        double mejor = 0.05;
        while (!Boolean.TRUE.equals(nodo.get("hoja"))) {
            String var = (String) nodo.get("variable");
            boolean si = x.getOrDefault(var, 0).doubleValue() > ((Number) nodo.get("umbral")).doubleValue();
            Map<String, Object> tomada = arbol.get(((Number) nodo.get(si ? "si" : "no")).intValue());
            Map<String, Object> otra = arbol.get(((Number) nodo.get(si ? "no" : "si")).intValue());
            double diferencia = ((Number) otra.get("prob")).doubleValue() - ((Number) tomada.get("prob")).doubleValue();
            if (ACCIONABLES.contains(var) && diferencia > mejor) {
                mejor = diferencia;
                frase = (String) nodo.get(si ? "frase_no" : "frase_si");
                variable = var;
            }
            nodo = tomada;
        }
        if (frase == null) return "";
        String consejo = "Las postulaciones que " + frase + " suelen ser aceptadas más.";
        List<String> faltan = (List<String>) p.get("faltan");
        if ("pct_habilidades".equals(variable) && !faltan.isEmpty()) {
            consejo += " Te falta: " + String.join(", ", faltan.subList(0, Math.min(3, faltan.size()))) + ".";
        }
        return consejo;
    }
}
