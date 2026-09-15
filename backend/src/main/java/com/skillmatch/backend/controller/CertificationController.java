package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.CertificationRequest;
import com.skillmatch.backend.dto.CertificationResponse;
import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.CertificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users/{userId}/certifications")
@RequiredArgsConstructor
public class CertificationController {

    private final CertificationService certificationService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<CertificationResponse>> getUserCertifications(
            @PathVariable(required = false) String userId) {
        return ResponseEntity.ok(certificationService.getUserCertifications(resolveUserId(userId)));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> addCertification(
            @PathVariable(required = false) String userId,
            @Valid @RequestBody CertificationRequest request) {
        String currentUserId = currentUserId();
        String targetUserId = resolveUserId(userId, currentUserId);
        if (!currentUserId.equals(targetUserId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para agregar certificación a este perfil"));
        }
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(certificationService.addCertification(targetUserId, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PutMapping("/{certificationId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateCertification(
            @PathVariable(required = false) String userId,
            @PathVariable String certificationId,
            @Valid @RequestBody CertificationRequest request) {
        String currentUserId = currentUserId();
        String targetUserId = resolveUserId(userId, currentUserId);
        if (!currentUserId.equals(targetUserId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para actualizar esta certificación"));
        }
        try {
            return ResponseEntity.ok(certificationService.updateCertification(targetUserId, certificationId, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/{certificationId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> deleteCertification(
            @PathVariable(required = false) String userId,
            @PathVariable String certificationId) {
        String currentUserId = currentUserId();
        String targetUserId = resolveUserId(userId, currentUserId);
        if (!currentUserId.equals(targetUserId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para eliminar esta certificación"));
        }
        try {
            certificationService.deleteCertification(targetUserId, certificationId);
            return ResponseEntity.ok(new MessageResponse("Certificación eliminada exitosamente"));
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
