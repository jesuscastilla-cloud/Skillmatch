package com.skillmatch.backend.controller;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

import com.skillmatch.backend.model.PreferenciasCorreo;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.AvisosCorreoService;

import lombok.RequiredArgsConstructor;

/**
 * Que correos recibe cada cuenta (PDF: "Cada persona elige que correos recibe y cada correo trae
 * un enlace para dejar de recibirlo").
 *
 * GET  /api/correos/preferencias        -> mis preferencias (con sesion)
 * PUT  /api/correos/preferencias        -> cambiarlas, p. ej. {"vacantes": true}
 * GET  /api/public/correos/baja?u&k&t   -> pagina que pregunta "¿Dejar de recibir...?" (sin sesion)
 * POST /api/public/correos/baja         -> la baja de verdad. Va en POST para que los programas que
 *                                          revisan enlaces en los correos no den de baja sin querer.
 *
 * No hace falta tocar SecurityConfig: /api/public/** ya es publico y lo demas pide sesion.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CorreosController {

    private static final Set<String> TIPOS = Set.of(PreferenciasCorreo.RESPUESTA, PreferenciasCorreo.MENSAJES,
            PreferenciasCorreo.VACANTES, PreferenciasCorreo.POSTULACIONES);

    private static final Map<String, String> NOMBRES = Map.of(
            PreferenciasCorreo.RESPUESTA, "las respuestas de las empresas a tus postulaciones",
            PreferenciasCorreo.MENSAJES, "los avisos de mensajes sin leer",
            PreferenciasCorreo.VACANTES, "las vacantes nuevas de los lunes",
            PreferenciasCorreo.POSTULACIONES, "el resumen diario de candidatos");

    private final AvisosCorreoService avisos;

    @GetMapping("/correos/preferencias")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> preferencias(@AuthenticationPrincipal UserDetailsImpl actual) {
        return ResponseEntity.ok(comoMapa(avisos.preferencias(id(actual))));
    }

    @PutMapping("/correos/preferencias")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> cambiar(@AuthenticationPrincipal UserDetailsImpl actual,
                                     @RequestBody Map<String, Boolean> cambios) {
        if (cambios == null || !TIPOS.containsAll(cambios.keySet())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Tipo de correo desconocido"));
        }
        return ResponseEntity.ok(comoMapa(avisos.cambiar(id(actual), cambios)));
    }

    @GetMapping(value = "/public/correos/baja", produces = MediaType.TEXT_HTML_VALUE)
    public String preguntarBaja(@RequestParam String u, @RequestParam String k, @RequestParam String t) {
        if (!TIPOS.contains(k)) return pagina("Enlace no válido", "<p>Este enlace no es válido.</p>");
        return pagina("Dejar de recibir correos",
                "<p>¿Quieres dejar de recibir " + NOMBRES.get(k) + "?</p>"
                + "<form method=\"post\" action=\"/api/public/correos/baja\">"
                + oculto("u", u) + oculto("k", k) + oculto("t", t)
                + "<button type=\"submit\">Sí, dejar de recibirlos</button></form>"
                + "<p class=\"nota\">Los códigos de seguridad (para entrar o cambiar la contraseña) siempre llegan.</p>");
    }

    @PostMapping(value = "/public/correos/baja", produces = MediaType.TEXT_HTML_VALUE)
    public String darseDeBaja(@RequestParam String u, @RequestParam String k, @RequestParam String t) {
        if (!TIPOS.contains(k) || !avisos.darseDeBaja(u, k, t)) {
            return pagina("Enlace no válido", "<p>Este enlace no es válido o ya venció. "
                    + "Puedes elegir tus correos en tu perfil, en «Correos que recibo».</p>");
        }
        return pagina("Listo", "<p>Ya no te enviaremos " + NOMBRES.get(k) + ".</p>"
                + "<p class=\"nota\">Si cambias de idea, actívalo en tu perfil, en «Correos que recibo».</p>"
                + "<p><a href=\"/pages/index.html\">Volver a SkillMatch</a></p>");
    }

    private static Map<String, Object> comoMapa(PreferenciasCorreo p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put(PreferenciasCorreo.RESPUESTA, p.isRespuesta());
        m.put(PreferenciasCorreo.MENSAJES, p.isMensajes());
        m.put(PreferenciasCorreo.VACANTES, p.isVacantes());
        m.put(PreferenciasCorreo.POSTULACIONES, p.isPostulaciones());
        return m;
    }

    private static String id(UserDetailsImpl actual) {
        if (actual == null) throw new AccessDeniedException("Usuario no autenticado");
        return actual.getId();
    }

    private static String oculto(String nombre, String valor) {
        return "<input type=\"hidden\" name=\"" + nombre + "\" value=\"" + HtmlUtils.htmlEscape(valor) + "\">";
    }

    /** Una pagina minima con los colores de SkillMatch (sin scripts). */
    private static String pagina(String titulo, String cuerpo) {
        return "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
                + "<meta name=\"robots\" content=\"noindex\"><title>" + titulo + " | SkillMatch</title><style>"
                + "body{margin:0;font-family:system-ui,sans-serif;background:#f4f7fb;color:#13294b;display:grid;place-items:center;min-height:100vh;padding:16px}"
                + "main{background:#fff;border-radius:16px;padding:32px;max-width:440px;box-shadow:0 8px 30px rgba(19,41,75,.1)}"
                + "h1{font-size:1.4rem;margin:0 0 12px}button{background:#12a5a5;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-size:1rem;cursor:pointer}"
                + ".nota{color:#5b6b82;font-size:.9rem}a{color:#0e7f86}"
                + "@media (prefers-color-scheme: dark){body{background:#0d1726;color:#e6edf6}main{background:#14233a}.nota{color:#9fb0c6}a{color:#5fd3d3}}"
                + "</style></head><body><main><h1>" + titulo + "</h1>" + cuerpo + "</main></body></html>";
    }
}
