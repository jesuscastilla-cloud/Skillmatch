package com.skillmatch.backend.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Los planes para empresas y sus limites. La pagina de planes y el panel "Plan y uso" leen esto
 * mismo (GET /api/public/planes), asi que los numeros solo se cambian aqui.
 *
 * Por que estos cupos: cada invitacion manda un correo (y el Profesional, un recordatorio). El sitio
 * envia por el Gmail del proyecto, que acepta unos 500 correos al dia, y se reserva un tope de 400
 * correos automaticos diarios (app.correo.maximo-al-dia). 300 invitaciones al mes son ~10 por dia
 * habil por empresa: con eso el tope alcanza para varias decenas de empresas de pago a la vez.
 * Ningun plan es ilimitado.
 */
public final class CatalogoPlanes {

    public static final String BASICO = "BASICO";
    public static final String PROFESIONAL = "PROFESIONAL";

    public record Plan(String id, String nombre, long precioMensual, String periodo, int invitacionesMes,
                       int maxPorEnvio, int procesosActivos, int horariosPorProceso, boolean recordatorios,
                       boolean exportarRespuestas, List<String> beneficios) {
        public Map<String, Object> comoMapa() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id); m.put("nombre", nombre); m.put("precioMensual", precioMensual); m.put("periodo", periodo);
            m.put("moneda", "COP");
            m.put("invitacionesMes", invitacionesMes); m.put("maxPorEnvio", maxPorEnvio);
            m.put("procesosActivos", procesosActivos); m.put("horariosPorProceso", horariosPorProceso);
            m.put("recordatorios", recordatorios); m.put("exportarRespuestas", exportarRespuestas);
            m.put("beneficios", beneficios);
            return m;
        }
    }

    public static final Plan PLAN_BASICO = new Plan(BASICO, "Básico", 0, "mes", 20, 10, 2, 3, false, false, List.of(
            "Invita hasta 20 candidatos al mes a una entrevista o evaluación",
            "Hasta 10 candidatos en cada envío",
            "Propón hasta 3 horarios por proceso",
            "Mira quién confirmó y quién no puede, en un solo panel"));

    public static final Plan PLAN_PROFESIONAL = new Plan(PROFESIONAL, "Profesional", 49_900, "mes", 300, 50, 15, 8, true, true, List.of(
            "Invita hasta 300 candidatos al mes",
            "Hasta 50 candidatos en cada envío",
            "Propón hasta 8 horarios por proceso, con cupos en cada uno",
            "Envía un recordatorio a quienes no han respondido",
            "Descarga las respuestas en Excel",
            "Hasta 15 procesos abiertos a la vez"));

    public static final List<Plan> TODOS = List.of(PLAN_BASICO, PLAN_PROFESIONAL);

    /** Meses que se pueden pedir de una vez */
    public static final List<Integer> MESES_PERMITIDOS = List.of(1, 3, 6);

    private CatalogoPlanes() { }

    public static Plan porId(String id) {
        return PROFESIONAL.equals(id) ? PLAN_PROFESIONAL : PLAN_BASICO;
    }
}
