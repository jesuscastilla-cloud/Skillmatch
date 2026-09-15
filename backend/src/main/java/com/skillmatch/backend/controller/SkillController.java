package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.dto.SkillRequest;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.SkillService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users/{userId}/skills")
@RequiredArgsConstructor
public class SkillController {

    private final SkillService skillService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<Map<String, Object>>> getUserSkills(
            @PathVariable(required = false) String userId) {
        String targetUserId = resolveUserId(userId);
        return ResponseEntity.ok(skillService.getUserSkills(targetUserId));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> addSkill(
            @PathVariable(required = false) String userId,
            @Valid @RequestBody SkillRequest request) {
        String currentUserId = currentUserId();
        String targetUserId = resolveUserId(userId, currentUserId);
        if (!currentUserId.equals(targetUserId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para agregar skills a este perfil"));
        }
        try {
            Map<String, Object> skill = skillService.addSkill(targetUserId, request);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "message", "Habilidad agregada exitosamente",
                    "skill", skill));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PutMapping("/{skillId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateSkill(
            @PathVariable(required = false) String userId,
            @PathVariable String skillId,
            @Valid @RequestBody SkillRequest request) {
        String currentUserId = currentUserId();
        String targetUserId = resolveUserId(userId, currentUserId);
        if (!currentUserId.equals(targetUserId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para actualizar esta skill"));
        }
        try {
            Map<String, Object> skill = skillService.updateSkill(targetUserId, skillId, request);
            return ResponseEntity.ok(Map.of("message", "Habilidad actualizada exitosamente", "skill", skill));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/{skillId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> deleteSkill(
            @PathVariable(required = false) String userId,
            @PathVariable String skillId) {
        String currentUserId = currentUserId();
        String targetUserId = resolveUserId(userId, currentUserId);
        if (!currentUserId.equals(targetUserId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para eliminar esta skill"));
        }
        try {
            skillService.deleteSkill(targetUserId, skillId);
            return ResponseEntity.ok(new MessageResponse("Habilidad eliminada exitosamente"));
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
