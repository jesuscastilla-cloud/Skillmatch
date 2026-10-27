package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.CorreoRequest;
import com.skillmatch.backend.dto.ResetPasswordRequest;
import com.skillmatch.backend.dto.LoginRequest;
import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.dto.RegisterRequest;
import com.skillmatch.backend.security.AuthCookieService;
import com.skillmatch.backend.service.AuthenticationService;
import com.skillmatch.backend.service.RecuperacionService;
import com.skillmatch.backend.service.RegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
    private final AuthCookieService authCookieService;
    private final RecuperacionService recuperacionService;

    @Operation(summary = "Iniciar sesión", description = "Autentica al usuario y devuelve un JWT como cookie httpOnly")
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest loginRequest,
            HttpServletResponse response) {
        AuthResponse authResponse = authenticationService.login(loginRequest);
        authCookieService.setAuthCookie(response, authResponse.getToken());
        return ResponseEntity.ok(authResponse);
    }

    @Operation(summary = "Registrar usuario o empresa", description = "Crea una cuenta nueva y devuelve un JWT como cookie httpOnly")
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest registerRequest,
            HttpServletResponse response) {
        AuthResponse authResponse = registrationService.register(registerRequest);
        authCookieService.setAuthCookie(response, authResponse.getToken());
        return ResponseEntity.ok(authResponse);
    }

    @Operation(summary = "Olvidé mi contraseña", description = "Envía un código al correo si tiene cuenta. Responde siempre lo mismo")
    @PostMapping("/forgot-password")
    public ResponseEntity<MessageResponse> forgotPassword(@Valid @RequestBody CorreoRequest request) {
        recuperacionService.pedirCodigo(request.getEmail());
        return ResponseEntity.ok(new MessageResponse(RecuperacionService.MENSAJE_ENVIADO));
    }

    @Operation(summary = "Cambiar la contraseña con el código", description = "Cierra todas las sesiones abiertas")
    @PostMapping("/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        recuperacionService.cambiarClave(request.getEmail(), request.getCodigo().trim(), request.getNewPassword());
        return ResponseEntity.ok(new MessageResponse("Listo: tu contraseña quedó cambiada. Ya puedes iniciar sesión."));
    }

    @Operation(summary = "Cerrar sesión", description = "Invalida el JWT en el servidor y elimina la cookie")
    @PostMapping("/logout")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse> logout(HttpServletRequest request, HttpServletResponse response) {
        String token = extractToken(request);
        if (token != null) {
            authenticationService.logout(token);
        }
        authCookieService.clearAuthCookie(response);
        return ResponseEntity.ok(new MessageResponse("Sesión cerrada exitosamente"));
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (AuthCookieService.COOKIE_NAME.equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
