package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.CompanyRequest;
import com.skillmatch.backend.dto.CompanyResponse;
import com.skillmatch.backend.dto.DatosEmpresaRequest;
import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.security.UserDetailsImpl;
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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Empresas", description = "Consulta y gestión de perfiles de empresa")
@RestController
@RequestMapping("/api/companies")
@RequiredArgsConstructor
public class CompanyController {

    private final CompanyService companyService;

    /** Tope de "Acerca de nosotros" (el mismo de DatosEmpresaRequest.description). */
    static final int MAX_DESCRIPCION = 5000;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createCompany(@Valid @RequestBody CompanyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(companyService.createCompany(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateCompany(@PathVariable String id,
                                           @Valid @RequestBody CompanyRequest request) {
        return ResponseEntity.ok(companyService.updateCompany(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteCompany(@PathVariable String id) {
        companyService.deleteCompany(id);
        return ResponseEntity.ok(new MessageResponse("Empresa eliminada exitosamente"));
    }

    @PostMapping("/{id}/verify")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> verifyCompany(@PathVariable String id) {
        companyService.verifyCompany(id);
        return ResponseEntity.ok(new MessageResponse("Empresa verificada exitosamente"));
    }

    @Operation(summary = "Editar los datos de la empresa",
               description = "El dueño (o un ADMIN) cambia nombre, sector, tamaño, ciudad, sitio web, teléfono, año y beneficios. "
                       + "Campos opcionales: null no cambia, \"\" quita. Correo, verificada y activa no se cambian aquí")
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or @companyService.isOwner(#id, authentication.principal.id)")
    public ResponseEntity<CompanyResponse> updateCompanyData(@PathVariable String id,
                                                             @Valid @RequestBody DatosEmpresaRequest datos) {
        // Los errores (nombre que no vale, teléfono inválido) los responde GlobalExceptionHandler con su mensaje
        return ResponseEntity.ok(companyService.actualizarDatos(id, datos));
    }

    @Operation(summary = "Actualizar descripción", description = "El dueño de la empresa o un ADMIN actualiza la descripción del perfil")
    @PatchMapping("/{id}/description")
    @PreAuthorize("hasRole('ADMIN') or @companyService.isOwner(#id, authentication.principal.id)")
    public ResponseEntity<?> updateCompanyDescription(
            @PathVariable String id,
            @RequestBody Map<String, String> request) {
        String description = request.get("description");
        if (description == null || description.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("La descripción no puede estar vacía"));
        }
        // El mismo tope que "Editar datos" (DatosEmpresaRequest): antes cabía hasta 1 MB de texto
        if (description.trim().length() > MAX_DESCRIPCION) {
            return ResponseEntity.badRequest().body(new MessageResponse(
                    "La descripción puede tener hasta " + MAX_DESCRIPCION + " caracteres"));
        }
        return ResponseEntity.ok(companyService.updateCompanyDescription(id, description.trim()));
    }

    @Operation(summary = "Obtener empresa", description = "Devuelve el perfil público de una empresa por ID")
    @GetMapping("/{id}")
    public ResponseEntity<?> getCompany(@PathVariable String id,
                                        @AuthenticationPrincipal UserDetailsImpl currentUser) {
        return ResponseEntity.ok(ocultarContacto(companyService.getCompanyById(id), currentUser));
    }

    @Operation(summary = "Listar empresas", description = "Devuelve todas las empresas paginadas (filtro opcional: status=active)")
    @GetMapping
    public ResponseEntity<Page<CompanyResponse>> getAllCompanies(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 10, sort = "name") Pageable pageable,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        Page<CompanyResponse> companies = "active".equals(status)
                ? companyService.getActiveCompanies(pageable)
                : companyService.getAllCompanies(pageable);
        return ResponseEntity.ok(companies.map(c -> ocultarContacto(c, currentUser)));
    }

    @GetMapping("/search")
    public ResponseEntity<List<CompanyResponse>> searchCompanies(
            @RequestParam String keyword,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        List<CompanyResponse> companies = companyService.searchCompanies(keyword);
        companies.forEach(c -> ocultarContacto(c, currentUser));
        return ResponseEntity.ok(companies);
    }

    @GetMapping("/filter")
    public ResponseEntity<List<CompanyResponse>> filterCompanies(
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String size,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        List<CompanyResponse> companies = companyService.getCompaniesByFilters(industry, location, size);
        companies.forEach(c -> ocultarContacto(c, currentUser));
        return ResponseEntity.ok(companies);
    }

    /**
     * El correo y el teléfono de una empresa solo los ve su dueño o un ADMIN.
     * Estas rutas son públicas: sin sesión, currentUser llega null.
     */
    private CompanyResponse ocultarContacto(CompanyResponse company, UserDetailsImpl currentUser) {
        boolean puedeVerContacto = currentUser != null
                && (currentUser.getId().equals(company.getUserId()) || isAdmin(currentUser));
        if (!puedeVerContacto) {
            company.setEmail(null);
            company.setPhone(null);
        }
        return company;
    }

    private boolean isAdmin(UserDetailsImpl user) {
        return user != null
                && user.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }

    @GetMapping("/{id}/statistics")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getCompanyStatistics(@PathVariable String id,
                                                  @AuthenticationPrincipal UserDetailsImpl currentUser) {
        // Cifras internas: solo el dueño de la empresa o un ADMIN
        if (!isAdmin(currentUser) && !companyService.isOwner(id, currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("No tienes permiso para ver estas estadísticas"));
        }
        return ResponseEntity.ok(companyService.getCompanyStatistics(id));
    }
}
