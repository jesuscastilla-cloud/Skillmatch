package com.skillmatch.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Rechaza (413) peticiones de más de 1 MB antes de leerlas. Lo más grande que
 * manda el frontend es una foto, ~450 KB en texto. Sin este tope, un cuerpo de
 * cientos de MB se leía entero en memoria antes de validar nada.
 */
@Component
public class TamanoMaximoFilter extends OncePerRequestFilter {

    static final long MAX_BYTES = 1024 * 1024;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (request.getContentLengthLong() > MAX_BYTES) {
            responder(response, HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE,
                    "La petición es demasiado grande (máximo 1 MB).");
            return;
        }
        // Un cuerpo enviado por partes no dice su tamaño (Content-Length) y se saltaba el
        // tope de arriba. El frontend nunca envía así: se pide que diga cuánto mide (411)
        if (request.getContentLengthLong() < 0 && enviadoPorPartes(request)) {
            responder(response, HttpServletResponse.SC_LENGTH_REQUIRED,
                    "La petición debe decir su tamaño (Content-Length).");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private static boolean enviadoPorPartes(HttpServletRequest request) {
        String transferencia = request.getHeader("Transfer-Encoding");
        return transferencia != null && transferencia.toLowerCase().contains("chunked");
    }

    private static void responder(HttpServletResponse response, int estado, String mensaje) throws IOException {
        response.setStatus(estado);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"message\":\"" + mensaje + "\"}");
    }
}
