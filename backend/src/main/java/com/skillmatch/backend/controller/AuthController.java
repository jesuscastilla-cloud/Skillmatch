package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.LoginRequest;
import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.dto.RegisterRequest;
import com.skillmatch.backend.service.AuthenticationService;
import com.skillmatch.backend.service.RegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Autenticación", description = "Registro, login y logout de usuarios")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationService authenticationService;
    private final RegistrationService registrationService;

    /*
     * En produccion el frontend suele estar en otro dominio (Netlify -> Railway).
     * Para que el navegador acepte la cookie en ese caso hace falta
     * Secure=true y SameSite=None. En local, Secure=false y SameSite=Lax.
     * Se controla con COOKIE_SECURE y COOKIE_SAME_SITE.
     */
    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${app.cookie.same-site:Lax}")
    private String cookieSameSite;

    @Operation(summary = "Iniciar sesión", description = "Autentica al usuario y devuelve un JWT como cookie httpOnly")
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest loginRequest,
            HttpServletResponse response) {
        AuthResponse authResponse = authenticationService.login(loginRequest);
        setCookie(response, authResponse.getToken());
        return ResponseEntity.ok(authResponse);
    }

    @Operation(summary = "Registrar usuario o empresa", description = "Crea una cuenta nueva y devuelve un JWT como cookie httpOnly")
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest registerRequest,
            HttpServletResponse response) {
        AuthResponse authResponse = registrationService.register(registerRequest);
        setCookie(response, authResponse.getToken());
        return ResponseEntity.ok(authResponse);
    }

    @Operation(summary = "Cerrar sesión", description = "Invalida el JWT en el servidor y elimina la cookie")
    @PostMapping("/logout")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse> logout(HttpServletRequest request, HttpServletResponse response) {
        String token = extractToken(request);
        if (token != null) {
            authenticationService.logout(token);
        }
        clearCookie(response);
        return ResponseEntity.ok(new MessageResponse("Sesión cerrada exitosamente"));
    }

    private void setCookie(HttpServletResponse response, String jwt) {
        ResponseCookie cookie = ResponseCookie.from("auth_token", jwt)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(86400)
                .sameSite(cookieSameSite)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("auth_token", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(0)
                .sameSite(cookieSameSite)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("auth_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
