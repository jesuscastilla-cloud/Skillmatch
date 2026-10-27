package com.skillmatch.backend.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * La cookie httpOnly "auth_token" con el JWT. La usan el login, el registro,
 * el logout y el cambio de contraseña (que entrega un token nuevo).
 *
 * Secure se activa solo cuando la petición llegó por HTTPS (en Render siempre;
 * en http://localhost no). COOKIE_SECURE=true lo fuerza siempre.
 */
@Component
public class AuthCookieService {

    public static final String COOKIE_NAME = "auth_token";

    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${app.cookie.same-site:Lax}")
    private String cookieSameSite;

    @Value("${jwt.expiration:86400000}")
    private long expirationMillis;

    public void setAuthCookie(HttpServletResponse response, String jwt) {
        write(response, jwt, expirationMillis / 1000);
    }

    public void clearAuthCookie(HttpServletResponse response) {
        write(response, "", 0);
    }

    /** Detrás del proxy de Render, isSecure() lee X-Forwarded-Proto (server.forward-headers-strategy). */
    private boolean llegoPorHttps() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs
                && attrs.getRequest().isSecure();
    }

    private void write(HttpServletResponse response, String value, long maxAgeSeconds) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(cookieSecure || llegoPorHttps())
                .path("/")
                .maxAge(maxAgeSeconds)
                .sameSite(cookieSameSite)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
