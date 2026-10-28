package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.dto.RegistroTelefonoRequest;
import com.skillmatch.backend.dto.TelefonoRequest;
import com.skillmatch.backend.security.AuthCookieService;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.TelefonoAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Registro y entrada con el celular (código por SMS o WhatsApp). Apagado hasta que
 * haya proveedor: ver TelefonoAuthService y docs/CAMBIOS-FRONTEND.md (F12).
 */
@Tag(name = "Teléfono", description = "Registro y entrada con el celular y un código")
@RestController
@RequiredArgsConstructor
public class TelefonoController {

    private final TelefonoAuthService telefonoAuthService;
    private final AuthCookieService authCookieService;

    @Operation(summary = "¿Se puede usar el teléfono?", description = "Para mostrar u ocultar \"Entrar con mi celular\"")
    @GetMapping("/api/auth/phone/disponible")
    public Map<String, Boolean> disponible() {
        return Map.of("disponible", telefonoAuthService.disponible());
    }

    @Operation(summary = "Registrarse con el celular", description = "Envía un código; la cuenta se crea al confirmarlo")
    @PostMapping("/api/auth/phone/register")
    public ResponseEntity<MessageResponse> registrar(@Valid @RequestBody RegistroTelefonoRequest request) {
        telefonoAuthService.iniciarRegistro(request);
        return ResponseEntity.accepted().body(new MessageResponse(TelefonoAuthService.MENSAJE_CODIGO));
    }

    @PostMapping("/api/auth/phone/register/verify")
    public ResponseEntity<AuthResponse> confirmarRegistro(@Valid @RequestBody TelefonoRequest request,
                                                          HttpServletResponse response) {
        return conSesion(telefonoAuthService.confirmarRegistro(request.getPhone(), codigo(request)), response);
    }

    @Operation(summary = "Pedir código para entrar", description = "Responde siempre lo mismo")
    @PostMapping("/api/auth/phone/code")
    public ResponseEntity<MessageResponse> pedirCodigo(@Valid @RequestBody TelefonoRequest request) {
        telefonoAuthService.pedirCodigoEntrada(request.getPhone());
        return ResponseEntity.ok(new MessageResponse(TelefonoAuthService.MENSAJE_CODIGO));
    }

    @PostMapping("/api/auth/phone/login")
    public ResponseEntity<AuthResponse> entrar(@Valid @RequestBody TelefonoRequest request,
                                               HttpServletResponse response) {
        return conSesion(telefonoAuthService.entrarConCodigo(request.getPhone(), codigo(request)), response);
    }

    @Operation(summary = "Agregar un teléfono a mi cuenta", description = "Envía un código al número nuevo")
    @PostMapping("/api/users/me/phone/code")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse> pedirCodigoTelefonoNuevo(@Valid @RequestBody TelefonoRequest request,
                                                                    @AuthenticationPrincipal UserDetailsImpl user) {
        telefonoAuthService.pedirCodigoVerificacion(user.getId(), request.getPhone());
        return ResponseEntity.ok(new MessageResponse(TelefonoAuthService.MENSAJE_CODIGO));
    }

    @PostMapping("/api/users/me/phone/verify")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse> confirmarTelefonoNuevo(@Valid @RequestBody TelefonoRequest request,
                                                                  @AuthenticationPrincipal UserDetailsImpl user) {
        telefonoAuthService.confirmarTelefono(user.getId(), request.getPhone(), codigo(request));
        return ResponseEntity.ok(new MessageResponse("Listo: tu número quedó confirmado. Ya puedes entrar con él."));
    }

    private static String codigo(TelefonoRequest request) {
        if (request.getCodigo() == null || request.getCodigo().isBlank()) {
            throw new IllegalArgumentException("Escribe el código que te enviamos");
        }
        return request.getCodigo().trim();
    }

    private ResponseEntity<AuthResponse> conSesion(AuthResponse sesion, HttpServletResponse response) {
        authCookieService.setAuthCookie(response, sesion.getToken());
        return ResponseEntity.ok(sesion);
    }
}
