package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.dto.UpdatePasswordRequest;
import com.skillmatch.backend.dto.UpdateProfileRequest;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.security.AuthCookieService;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.DatosPersonalesService;
import com.skillmatch.backend.service.UserService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final JwtTokenProvider tokenProvider;
    private final AuthCookieService authCookieService;
    private final DatosPersonalesService datosPersonalesService;

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal UserDetailsImpl user) {
        if (user == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        return ResponseEntity.ok(userService.getUserProfile(user.getId()));
    }

    /**
     * "Descargar mis datos" (derecho a conocer, Ley 1581). Solo la cuenta de la
     * sesión: no hay ID en la ruta que se pueda cambiar.
     */
    @GetMapping("/me/export")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> exportMyData(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"mis-datos-skillmatch.json\"")
                .body(datosPersonalesService.exportar(currentUser.getId()));
    }

    /**
     * "Eliminar mi cuenta" (derecho a suprimir, Ley 1581). Pide la contraseña actual
     * en el cuerpo: {"password": "..."}. Cierra la sesión borrando la cookie.
     */
    @DeleteMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> deleteMyAccount(@RequestBody(required = false) Map<String, String> body,
                                             @AuthenticationPrincipal UserDetailsImpl currentUser,
                                             HttpServletResponse response) {
        if (currentUser == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        try {
            datosPersonalesService.borrarCuenta(currentUser.getId(), body == null ? null : body.get("password"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
        authCookieService.clearAuthCookie(response);
        return ResponseEntity.ok(new MessageResponse("Tu cuenta y tus datos fueron eliminados"));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getUserById(@PathVariable String id,
                                         @AuthenticationPrincipal UserDetailsImpl currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        // El correo y el teléfono solo los ve la propia persona o un ADMIN
        boolean propioOAdmin = currentUser.getId().equals(id) || isAdmin(currentUser);
        return ResponseEntity.ok(propioOAdmin ? userService.getUserProfile(id) : userService.getPublicProfile(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateProfile(
            @PathVariable String id,
            @Valid @RequestBody UpdateProfileRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        if (!currentUser.getId().equals(id)) {
            return ResponseEntity.status(403).body(new MessageResponse("No tienes permiso para actualizar este perfil"));
        }
        var updatedUser = userService.updateProfile(id, request);
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Perfil actualizado exitosamente");
        response.put("user", userService.getUserProfile(updatedUser.getId()));
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/profile-image")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateProfileImage(
            @PathVariable String id,
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        if (!currentUser.getId().equals(id)) {
            return ResponseEntity.status(403).body(new MessageResponse("No tienes permiso para actualizar esta imagen"));
        }
        String imageUrl = request.get("imageUrl");
        if (imageUrl == null || imageUrl.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("La URL de la imagen es requerida"));
        }
        var updatedUser = userService.updateProfileImage(id, imageUrl);
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Foto de perfil actualizada exitosamente");
        response.put("profileImageUrl", updatedUser.getProfileImageUrl());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/cover-image")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateCoverImage(
            @PathVariable String id,
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        if (!currentUser.getId().equals(id)) {
            return ResponseEntity.status(403).body(new MessageResponse("No tienes permiso para actualizar esta imagen"));
        }
        String imageUrl = request.get("imageUrl");
        if (imageUrl == null || imageUrl.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("La URL de la imagen es requerida"));
        }
        var updatedUser = userService.updateCoverImage(id, imageUrl);
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Portada actualizada exitosamente");
        response.put("coverImageUrl", updatedUser.getCoverImageUrl());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updatePassword(
            @PathVariable String id,
            @Valid @RequestBody UpdatePasswordRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            HttpServletResponse response) {
        if (currentUser == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        if (!currentUser.getId().equals(id)) {
            return ResponseEntity.status(403).body(new MessageResponse("No tienes permiso para actualizar esta contraseña"));
        }
        try {
            // Cambiar la contraseña cierra todas las sesiones; esta recibe un token nuevo
            User updated = userService.updatePassword(id, request);
            String token = tokenProvider.generateToken(UserDetailsImpl.build(updated));
            authCookieService.setAuthCookie(response, token);
            Map<String, Object> body = new HashMap<>();
            body.put("message", "Contraseña actualizada exitosamente");
            body.put("token", token);
            // Cuándo vence la cookie nueva: el frontend lo guarda para saber si hay sesión (F4)
            body.put("expiresAt", System.currentTimeMillis() + tokenProvider.getExpirationMillis());
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/{id}/statistics")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getUserStatistics(@PathVariable String id,
                                                @AuthenticationPrincipal UserDetailsImpl currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        if (!currentUser.getId().equals(id) && !isAdmin(currentUser)) {
            return ResponseEntity.status(403).body(new MessageResponse("No tienes permiso para ver estas estadísticas"));
        }
        try {
            return ResponseEntity.ok(userService.getUserStatistics(id));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(new MessageResponse("Error al obtener estadísticas: " + e.getMessage()));
        }
    }

    private boolean isAdmin(UserDetailsImpl user) {
        return user.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
