package com.skillmatch.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Respuesta para quien pide una ruta privada sin sesión: 401 con el mismo
 * JSON {"message": ...} que usa el resto de la API. No se registra en el log:
 * es lo normal cuando una sesión vence.
 */
@Component
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        // Si la sesión se cerró porque entró en otro dispositivo, el frontend lo dice así
        if (Boolean.TRUE.equals(request.getAttribute(SesionUnicaService.ATRIBUTO_REEMPLAZADA))) {
            response.getWriter().write("{\"message\":\"" + SesionUnicaService.MENSAJE_REEMPLAZADA
                    + "\",\"motivo\":\"OTRA_SESION\"}");
            return;
        }
        response.getWriter().write("{\"message\":\"Necesitas iniciar sesión\"}");
    }
}
