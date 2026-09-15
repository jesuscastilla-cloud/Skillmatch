package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.JobRequest;
import com.skillmatch.backend.dto.JobResponse;
import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.JobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Ofertas de trabajo", description = "Creación, consulta y gestión de ofertas laborales")
@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;

    @Operation(summary = "Crear oferta", description = "Crea una nueva oferta laboral (solo empresas)")
    @PostMapping
    @PreAuthorize("hasRole('EMPRESA') or hasRole('ADMIN')")
    public ResponseEntity<?> createJob(@Valid @RequestBody JobRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(jobService.createJob(request));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new MessageResponse("Error al crear oferta: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('EMPRESA') or hasRole('ADMIN')")
    public ResponseEntity<?> updateJob(@PathVariable String id,
                                       @Valid @RequestBody JobRequest request,
                                       @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(jobService.updateJob(id, request, currentUser.getId()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new MessageResponse("Error al actualizar oferta: " + e.getMessage()));
        }
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('EMPRESA') or hasRole('ADMIN')")
    public ResponseEntity<?> changeStatus(@PathVariable String id,
                                          @RequestParam String status,
                                          @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(jobService.changeStatus(id, status, currentUser.getId()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new MessageResponse("Error al cambiar estado: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('EMPRESA') or hasRole('ADMIN')")
    public ResponseEntity<?> deleteJob(@PathVariable String id,
                                       @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            jobService.deleteJob(id, currentUser.getId());
            return ResponseEntity.ok(new MessageResponse("Oferta eliminada exitosamente"));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error al eliminar oferta: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getJobById(@PathVariable String id) {
        try {
            return ResponseEntity.ok(jobService.getJobById(id));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Oferta no encontrada: " + e.getMessage()));
        }
    }

    @Operation(summary = "Listar ofertas activas", description = "Devuelve página de ofertas activas, ordenadas por fecha (público)")
    @GetMapping
    public ResponseEntity<Page<JobResponse>> getAllActiveJobs(
            @RequestParam(defaultValue = "0")          int page,
            @RequestParam(defaultValue = "20")         int size,
            @RequestParam(defaultValue = "postedDate") String sortBy,
            @RequestParam(defaultValue = "desc")       String direction) {
        size = Math.min(size, 50);
        return ResponseEntity.ok(jobService.getAllActiveJobs(buildPageable(page, size, sortBy, direction)));
    }

    @Operation(summary = "Ofertas recientes", description = "Devuelve las 10 ofertas más recientes para la landing page")
    @GetMapping("/recent")
    public ResponseEntity<List<JobResponse>> getRecentJobs() {
        return ResponseEntity.ok(jobService.getRecentJobs());
    }

    @Operation(summary = "Buscar ofertas", description = "Búsqueda por palabra clave en título y descripción")
    @GetMapping("/search")
    public ResponseEntity<Page<JobResponse>> searchJobs(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "0")          int page,
            @RequestParam(defaultValue = "20")         int size,
            @RequestParam(defaultValue = "postedDate") String sortBy,
            @RequestParam(defaultValue = "desc")       String direction) {
        size = Math.min(size, 50);
        return ResponseEntity.ok(jobService.searchJobs(keyword, buildPageable(page, size, sortBy, direction)));
    }

    @GetMapping("/filter")
    public ResponseEntity<Page<JobResponse>> filterJobs(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String modality,
            @RequestParam(required = false) String experienceLevel,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) Double minSalary,
            @RequestParam(required = false) Double maxSalary,
            @RequestParam(defaultValue = "0")          int page,
            @RequestParam(defaultValue = "20")         int size,
            @RequestParam(defaultValue = "postedDate") String sortBy,
            @RequestParam(defaultValue = "desc")       String direction) {
        size = Math.min(size, 50);
        return ResponseEntity.ok(jobService.getJobsByFilters(
                type, modality, experienceLevel, location, minSalary, maxSalary,
                buildPageable(page, size, sortBy, direction)));
    }

    @GetMapping("/company/{companyId}")
    public ResponseEntity<List<JobResponse>> getJobsByCompany(@PathVariable String companyId) {
        return ResponseEntity.ok(jobService.getJobsByCompany(companyId));
    }

    private Pageable buildPageable(int page, int size, String sortBy, String direction) {
        Sort sort = "asc".equalsIgnoreCase(direction) ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        return PageRequest.of(page, size, sort);
    }
}
