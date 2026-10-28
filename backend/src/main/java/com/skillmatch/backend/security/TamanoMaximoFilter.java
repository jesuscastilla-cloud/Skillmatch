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
            response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"La petición es demasiado grande (máximo 1 MB).\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
