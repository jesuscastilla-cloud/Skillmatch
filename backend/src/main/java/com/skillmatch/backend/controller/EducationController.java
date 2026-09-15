package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.EducationRequest;
import com.skillmatch.backend.dto.EducationResponse;
import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.EducationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users/{userId}/educations")
@RequiredArgsConstructor
public class EducationController {

    private final EducationService educationService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<EducationResponse>> getUserEducations(
            @PathVariable(required = false) String userId) {
        return ResponseEntity.ok(educationService.getUserEducations(resolveUserId(userId)));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> addEducation(
            @PathVariable(required = false) String userId,
            @Valid @RequestBody EducationRequest request) {
        String currentUserId = currentUserId();
        String targetUserId = resolveUserId(userId, currentUserId);
        if (!currentUserId.equals(targetUserId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para agregar educación a este perfil"));
        }
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(educationService.addEducation(targetUserId, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PutMapping("/{educationId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateEducation(
            @PathVariable(required = false) String userId,
            @PathVariable String educationId,
            @Valid @RequestBody EducationRequest request) {
        String currentUserId = currentUserId();
        String targetUserId = resolveUserId(userId, currentUserId);
        if (!currentUserId.equals(targetUserId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para actualizar esta educación"));
        }
        try {
            return ResponseEntity.ok(educationService.updateEducation(targetUserId, educationId, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/{educationId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> deleteEducation(
            @PathVariable(required = false) String userId,
            @PathVariable String educationId) {
        String currentUserId = currentUserId();
        String targetUserId = resolveUserId(userId, currentUserId);
        if (!currentUserId.equals(targetUserId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para eliminar esta educación"));
        }
        try {
            educationService.deleteEducation(targetUserId, educationId);
            return ResponseEntity.ok(new MessageResponse("Educación eliminada exitosamente"));
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
