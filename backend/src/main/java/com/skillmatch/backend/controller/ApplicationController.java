package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.ApplicationRequest;
import com.skillmatch.backend.dto.ApplicationResponse;
import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.ApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Postulaciones", description = "Gestión de postulaciones a ofertas laborales")
@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;

    @Operation(summary = "Crear postulación", description = "El candidato se postula a una oferta laboral")
    @PostMapping
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public ResponseEntity<?> createApplication(
            @Valid @RequestBody ApplicationRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        // Los errores los responde GlobalExceptionHandler con el mensaje tal cual: 409 si ya se
        // postuló (oportunidades.js reconoce "Ya te has postulado"), 400 si la vacante cerró
        String userId = requireUser(currentUser);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(applicationService.createApplication(userId, request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA') or hasRole('ADMIN')")
    public ResponseEntity<?> getApplicationById(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        return ResponseEntity.ok(applicationService.getApplicationById(
                id, requireUser(currentUser), hasRole(currentUser, "ADMIN")));
    }

    @Operation(summary = "Mis postulaciones", description = "Devuelve todas las postulaciones del usuario autenticado")
    @GetMapping("/my-applications")
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public ResponseEntity<?> getMyApplications(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        return ResponseEntity.ok(applicationService.getApplicationsByUser(requireUser(currentUser)));
    }

    @GetMapping("/job/{jobId}")
    @PreAuthorize("hasRole('EMPRESA') or hasRole('ADMIN')")
    public ResponseEntity<?> getApplicationsByJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        return ResponseEntity.ok(applicationService.getApplicationsByJob(
                jobId, requireUser(currentUser), hasRole(currentUser, "ADMIN")));
    }

    @Operation(summary = "Postulaciones por empresa", description = "Devuelve las postulaciones recibidas por la empresa (paginado, solo dueño)")
    @GetMapping("/company/{companyId}")
    @PreAuthorize("hasRole('EMPRESA') or hasRole('ADMIN')")
    public ResponseEntity<?> getApplicationsByCompany(
            @PathVariable String companyId,
            @PageableDefault(size = 20) Pageable pageable,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        Page<ApplicationResponse> apps = applicationService.getApplicationsByCompany(
                companyId, requireUser(currentUser), hasRole(currentUser, "ADMIN"), pageable);
        return ResponseEntity.ok(apps);
    }

    @GetMapping("/status/{status}")
    @PreAuthorize("hasRole('EMPRESA') or hasRole('ADMIN')")
    public ResponseEntity<List<ApplicationResponse>> getApplicationsByStatus(
            @PathVariable String status,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        return ResponseEntity.ok(applicationService.getApplicationsByStatus(
                status, requireUser(currentUser), hasRole(currentUser, "ADMIN")));
    }

    @Operation(summary = "Actualizar estado", description = "La empresa cambia el estado de una postulación")
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('EMPRESA') or hasRole('ADMIN')")
    public ResponseEntity<?> updateStatus(
            @PathVariable String id,
            @RequestParam String status,
            @Valid @RequestBody(required = false) NotasRequest cuerpo,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        // Las notas son internas de la empresa: van en el cuerpo, no en la dirección (?notes=),
        // que queda en los registros del servidor. Los errores los responde GlobalExceptionHandler
        String notes = cuerpo == null ? null : cuerpo.notes();
        return ResponseEntity.ok(applicationService.updateStatus(id, status, notes, requireUser(currentUser)));
    }

    /** Notas internas de la empresa sobre una postulación. */
    record NotasRequest(@Size(max = 1000, message = "Las notas no pueden tener más de 1000 caracteres") String notes) {
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public ResponseEntity<?> deleteApplication(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        String requesterId = requireUser(currentUser);
        // Solo ADMIN: una empresa no puede borrar postulaciones de nadie
        boolean isAdmin = hasRole(currentUser, "ADMIN");
        applicationService.deleteApplication(id, requesterId, isAdmin);
        return ResponseEntity.ok(new MessageResponse("Postulación eliminada exitosamente"));
    }

    @GetMapping("/job/{jobId}/count")
    @PreAuthorize("hasRole('EMPRESA') or hasRole('ADMIN')")
    public ResponseEntity<Long> countApplicationsByJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        return ResponseEntity.ok(applicationService.countApplicationsByJob(
                jobId, requireUser(currentUser), hasRole(currentUser, "ADMIN")));
    }

    @GetMapping("/check")
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public ResponseEntity<Boolean> hasUserApplied(
            @RequestParam String jobId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(applicationService.hasUserApplied(requireUser(currentUser), jobId));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(false);
        }
    }

    private String requireUser(UserDetailsImpl currentUser) {
        if (currentUser == null) throw new AccessDeniedException("Usuario no autenticado");
        return currentUser.getId();
    }

    private boolean hasRole(UserDetailsImpl currentUser, String roleName) {
        if (currentUser == null) return false;
        String expected = "ROLE_" + roleName.toUpperCase();
        return currentUser.getAuthorities().stream().anyMatch(a -> expected.equals(a.getAuthority()));
    }
}
