package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.dto.UpdatePasswordRequest;
import com.skillmatch.backend.dto.UpdateProfileRequest;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.UserService;
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

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal UserDetailsImpl user) {
        if (user == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        return ResponseEntity.ok(userService.getUserProfile(user.getId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getUserById(@PathVariable String id,
                                         @AuthenticationPrincipal UserDetailsImpl currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        return ResponseEntity.ok(userService.getUserProfile(id));
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
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        if (!currentUser.getId().equals(id)) {
            return ResponseEntity.status(403).body(new MessageResponse("No tienes permiso para actualizar esta contraseña"));
        }
        try {
            userService.updatePassword(id, request);
            return ResponseEntity.ok(new MessageResponse("Contraseña actualizada exitosamente"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/{id}/statistics")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getUserStatistics(@PathVariable String id,
                                                @AuthenticationPrincipal UserDetailsImpl currentUser) {
        if (currentUser == null) return ResponseEntity.status(401).body(new MessageResponse("Usuario no autenticado"));
        try {
            return ResponseEntity.ok(userService.getUserStatistics(id));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(new MessageResponse("Error al obtener estadísticas: " + e.getMessage()));
        }
    }
}
