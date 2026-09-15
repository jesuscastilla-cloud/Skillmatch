package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.ExperienceRequest;
import com.skillmatch.backend.dto.ExperienceResponse;
import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.ExperienceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users/{userId}/experiences")
@RequiredArgsConstructor
public class ExperienceController {

    private final ExperienceService experienceService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ExperienceResponse>> getUserExperiences(
            @PathVariable(required = false) String userId) {
        return ResponseEntity.ok(experienceService.getUserExperiences(resolveUserId(userId)));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> addExperience(
            @PathVariable(required = false) String userId,
            @Valid @RequestBody ExperienceRequest request) {
        String currentUserId = currentUserId();
        String targetUserId = resolveUserId(userId, currentUserId);
        if (!currentUserId.equals(targetUserId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para agregar experiencia a este perfil"));
        }
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(experienceService.addExperience(targetUserId, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PutMapping("/{experienceId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateExperience(
            @PathVariable(required = false) String userId,
            @PathVariable String experienceId,
            @Valid @RequestBody ExperienceRequest request) {
        String currentUserId = currentUserId();
        String targetUserId = resolveUserId(userId, currentUserId);
        if (!currentUserId.equals(targetUserId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para actualizar esta experiencia"));
        }
        try {
            return ResponseEntity.ok(experienceService.updateExperience(targetUserId, experienceId, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/{experienceId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> deleteExperience(
            @PathVariable(required = false) String userId,
            @PathVariable String experienceId) {
        String currentUserId = currentUserId();
        String targetUserId = resolveUserId(userId, currentUserId);
        if (!currentUserId.equals(targetUserId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para eliminar esta experiencia"));
        }
        try {
            experienceService.deleteExperience(targetUserId, experienceId);
            return ResponseEntity.ok(new MessageResponse("Experiencia eliminada exitosamente"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    private String currentUserId() {
        return ((UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal()).getId();
    }

    private String resolveUserId(String pathUserId) {
        return resolveUserId(pathUserId, currentUserId());
    }

    private String resolveUserId(String pathUserId, String fallback) {
        return (pathUserId != null && !pathUserId.equals("undefined")) ? pathUserId : fallback;
    }
}
