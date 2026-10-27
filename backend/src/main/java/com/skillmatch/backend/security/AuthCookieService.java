package com.skillmatch.backend.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * La cookie httpOnly "auth_token" con el JWT. La usan el login, el registro,
 * el logout y el cambio de contraseña (que entrega un token nuevo).
 *
 * En producción, si el frontend estuviera en otro dominio, harían falta
 * Secure=true y SameSite=None (COOKIE_SECURE y COOKIE_SAME_SITE).
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

    private void write(HttpServletResponse response, String value, long maxAgeSeconds) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(maxAgeSeconds)
                .sameSite(cookieSameSite)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
