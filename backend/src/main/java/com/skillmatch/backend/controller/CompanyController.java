package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.CompanyRequest;
import com.skillmatch.backend.dto.CompanyResponse;
import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.service.CompanyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Empresas", description = "Consulta y gestión de perfiles de empresa")
@RestController
@RequestMapping("/api/companies")
@RequiredArgsConstructor
public class CompanyController {

    private final CompanyService companyService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createCompany(@Valid @RequestBody CompanyRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(companyService.createCompany(request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateCompany(@PathVariable String id,
                                           @Valid @RequestBody CompanyRequest request) {
        try {
            return ResponseEntity.ok(companyService.updateCompany(id, request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteCompany(@PathVariable String id) {
        try {
            companyService.deleteCompany(id);
            return ResponseEntity.ok(new MessageResponse("Empresa eliminada exitosamente"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/verify")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> verifyCompany(@PathVariable String id) {
        try {
            companyService.verifyCompany(id);
            return ResponseEntity.ok(new MessageResponse("Empresa verificada exitosamente"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: " + e.getMessage()));
        }
    }

    @Operation(summary = "Actualizar descripción", description = "El dueño de la empresa o un ADMIN actualiza la descripción del perfil")
    @PatchMapping("/{id}/description")
    @PreAuthorize("hasRole('ADMIN') or @companyService.isOwner(#id, authentication.principal.id)")
    public ResponseEntity<?> updateCompanyDescription(
            @PathVariable String id,
            @RequestBody Map<String, String> request) {
        try {
            String description = request.get("description");
            if (description == null || description.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(new MessageResponse("La descripción no puede estar vacía"));
            }
            return ResponseEntity.ok(companyService.updateCompanyDescription(id, description));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: " + e.getMessage()));
        }
    }

    @Operation(summary = "Obtener empresa", description = "Devuelve el perfil público de una empresa por ID")
    @GetMapping("/{id}")
    public ResponseEntity<?> getCompany(@PathVariable String id) {
        try {
            return ResponseEntity.ok(companyService.getCompanyById(id));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: " + e.getMessage()));
        }
    }

    @Operation(summary = "Listar empresas", description = "Devuelve todas las empresas paginadas (filtro opcional: status=active)")
    @GetMapping
    public ResponseEntity<Page<CompanyResponse>> getAllCompanies(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 10, sort = "name") Pageable pageable) {
        if ("active".equals(status)) {
            return ResponseEntity.ok(companyService.getActiveCompanies(pageable));
        }
        return ResponseEntity.ok(companyService.getAllCompanies(pageable));
    }

    @GetMapping("/search")
    public ResponseEntity<List<CompanyResponse>> searchCompanies(@RequestParam String keyword) {
        return ResponseEntity.ok(companyService.searchCompanies(keyword));
    }

    @GetMapping("/filter")
    public ResponseEntity<List<CompanyResponse>> filterCompanies(
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String size) {
        return ResponseEntity.ok(companyService.getCompaniesByFilters(industry, location, size));
    }

    @GetMapping("/{id}/statistics")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getCompanyStatistics(@PathVariable String id) {
        try {
            return ResponseEntity.ok(companyService.getCompanyStatistics(id));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error al obtener estadísticas: " + e.getMessage()));
        }
    }
}
