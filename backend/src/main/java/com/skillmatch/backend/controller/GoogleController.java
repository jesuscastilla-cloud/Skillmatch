package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.CanjeGoogleRequest;
import com.skillmatch.backend.security.AuthCookieService;
import com.skillmatch.backend.service.GoogleAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Entrar con Google. El botón es un enlace a /oauth2/authorization/google (lo maneja
 * Spring); al volver, la página de login canjea aquí su código de un solo uso.
 * Ver docs/CAMBIOS-FRONTEND.md (F13).
 */
@Tag(name = "Google", description = "Entrar con Google")
@RestController
@RequestMapping("/api/auth/google")
@RequiredArgsConstructor
public class GoogleController {

    private final GoogleAuthService googleAuthService;
    private final AuthCookieService authCookieService;

    @Operation(summary = "¿Se puede entrar con Google?", description = "Para mostrar u ocultar \"Continuar con Google\"")
    @GetMapping("/disponible")
    public Map<String, Boolean> disponible() {
        return Map.of("disponible", googleAuthService.disponible());
    }

    @Operation(summary = "Canjear el código de Google", description = "Un solo uso, vence al minuto. Devuelve lo mismo que el login")
    @PostMapping("/canjear")
    public ResponseEntity<AuthResponse> canjear(@Valid @RequestBody CanjeGoogleRequest request,
                                                HttpServletResponse response) {
        AuthResponse sesion = googleAuthService.canjear(request.getCodigo().trim());
        authCookieService.setAuthCookie(response, sesion.getToken());
        return ResponseEntity.ok(sesion);
    }
}
