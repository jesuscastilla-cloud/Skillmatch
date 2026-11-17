package com.skillmatch.backend.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.skillmatch.backend.model.ConfiguracionComercial;
import com.skillmatch.backend.model.SolicitudPlan;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.CatalogoPlanes;
import com.skillmatch.backend.service.PlanService;
import com.skillmatch.backend.validation.EntradaSegura;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;

/**
 * Planes para empresas.
 *  Publico:  GET  /api/public/planes                      los planes y sus limites
 *  Empresa:  GET  /api/planes/mio                         plan actual, consumo, solicitudes y datos de pago
 *            POST /api/planes/solicitudes                 "Solicitar activacion"
 *            DELETE /api/planes/solicitudes/{id}          cancelar una solicitud pendiente
 *  Admin:    GET  /api/admin/planes/solicitudes?estado=   solicitudes
 *            POST /api/admin/planes/solicitudes/{id}/aprobar | /rechazar
 *            GET  /api/admin/planes/empresas              empresas con plan activo
 *            GET|PUT /api/admin/comercial                 datos para cobrar
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PlanController {

    private final PlanService planes;

    @GetMapping("/public/planes")
    public List<Map<String, Object>> catalogo() {
        return CatalogoPlanes.TODOS.stream().map(CatalogoPlanes.Plan::comoMapa).toList();
    }

    @GetMapping("/planes/mio")
    @PreAuthorize("hasRole('EMPRESA')")
    public Map<String, Object> mio(@AuthenticationPrincipal UserDetailsImpl yo) {
        return planes.resumen(yo.getId());
    }

    @PostMapping("/planes/solicitudes")
    @PreAuthorize("hasRole('EMPRESA')")
    public ResponseEntity<Map<String, Object>> solicitar(@AuthenticationPrincipal UserDetailsImpl yo, @Valid @RequestBody Solicitud r) {
        planes.solicitar(yo.getId(), r.getPlan(), r.getMeses(), r.getContactoNombre(), r.getContactoTelefono(), r.getNota());
        return ResponseEntity.status(201).body(planes.resumen(yo.getId()));
    }

    @DeleteMapping("/planes/solicitudes/{id}")
    @PreAuthorize("hasRole('EMPRESA')")
    public Map<String, Object> cancelar(@AuthenticationPrincipal UserDetailsImpl yo, @PathVariable String id) {
        planes.cancelarSolicitud(yo.getId(), id);
        return planes.resumen(yo.getId());
    }

    // ------------------------------------------------------------------ administracion

    @GetMapping("/admin/planes/solicitudes")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> solicitudes(@RequestParam(required = false) String estado) {
        if (estado != null && !estado.isBlank() && !List.of("PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA").contains(estado.toUpperCase())) {
            throw new IllegalArgumentException("Estado desconocido");
        }
        return planes.solicitudesParaAdmin(estado);
    }

    @PostMapping("/admin/planes/solicitudes/{id}/aprobar")
    @PreAuthorize("hasRole('ADMIN')")
    public SolicitudPlan aprobar(@AuthenticationPrincipal UserDetailsImpl yo, @PathVariable String id, @Valid @RequestBody(required = false) Decision d) {
        return planes.aprobar(yo.getId(), id, d == null ? null : d.getMeses(), d == null ? null : d.getNota());
    }

    @PostMapping("/admin/planes/solicitudes/{id}/rechazar")
    @PreAuthorize("hasRole('ADMIN')")
    public SolicitudPlan rechazar(@AuthenticationPrincipal UserDetailsImpl yo, @PathVariable String id, @Valid @RequestBody Decision d) {
        return planes.rechazar(yo.getId(), id, d.getNota());
    }

    @GetMapping("/admin/planes/empresas")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> empresasConPlan() {
        return planes.empresasConPlan();
    }

    @GetMapping("/admin/comercial")
    @PreAuthorize("hasRole('ADMIN')")
    public ConfiguracionComercial comercial() {
        return planes.configuracion();
    }

    @PutMapping("/admin/comercial")
    @PreAuthorize("hasRole('ADMIN')")
    public ConfiguracionComercial guardarComercial(@AuthenticationPrincipal UserDetailsImpl yo, @Valid @RequestBody Comercial c) {
        ConfiguracionComercial x = new ConfiguracionComercial();
        x.setRazonSocial(limpio(c.getRazonSocial()));
        x.setNit(limpio(c.getNit()));
        x.setBanco(limpio(c.getBanco()));
        x.setTipoCuenta(limpio(c.getTipoCuenta()));
        x.setNumeroCuenta(limpio(c.getNumeroCuenta()));
        x.setTitular(limpio(c.getTitular()));
        x.setCorreoPagos(limpio(c.getCorreoPagos()));
        x.setTelefonoPagos(limpio(c.getTelefonoPagos()));
        x.setInstrucciones(limpio(c.getInstrucciones()));
        return planes.guardarConfiguracion(yo.getId(), x);
    }

    private static String limpio(String s) { return s == null || s.isBlank() ? null : s.trim(); }

    // ------------------------------------------------------------------ peticiones

    @Data
    public static class Solicitud {
        @NotBlank(message = "Elige un plan.")
        @Pattern(regexp = CatalogoPlanes.PROFESIONAL, message = "Ese plan no se puede solicitar.")
        private String plan;
        @Min(value = 1, message = "Elige 1, 3 o 6 meses.") @Max(value = 6, message = "Elige 1, 3 o 6 meses.")
        private Integer meses;
        @Size(max = 100) @Pattern(regexp = EntradaSegura.REGEX_SIN_ETIQUETAS, message = EntradaSegura.MENSAJE_SIN_ETIQUETAS)
        private String contactoNombre;
        @Size(max = 25) @Pattern(regexp = "^$|^[+0-9 ()-]{7,25}$", message = "Escribe un teléfono válido.")
        private String contactoTelefono;
        @Size(max = 500) @Pattern(regexp = EntradaSegura.REGEX_SIN_ETIQUETAS, message = EntradaSegura.MENSAJE_SIN_ETIQUETAS)
        private String nota;
    }

    @Data
    public static class Decision {
        @Min(1) @Max(12)
        private Integer meses;
        @Size(max = 500) @Pattern(regexp = EntradaSegura.REGEX_SIN_ETIQUETAS, message = EntradaSegura.MENSAJE_SIN_ETIQUETAS)
        private String nota;
    }

    @Data
    public static class Comercial {
        @Size(max = 150) @Pattern(regexp = EntradaSegura.REGEX_SIN_ETIQUETAS, message = EntradaSegura.MENSAJE_SIN_ETIQUETAS) private String razonSocial;
        @Size(max = 30) @Pattern(regexp = "^$|^[0-9.\\- ]{5,30}$", message = "Escribe el NIT solo con números, puntos o guion.") private String nit;
        @Size(max = 80) @Pattern(regexp = EntradaSegura.REGEX_SIN_ETIQUETAS, message = EntradaSegura.MENSAJE_SIN_ETIQUETAS) private String banco;
        @Size(max = 40) @Pattern(regexp = EntradaSegura.REGEX_SIN_ETIQUETAS, message = EntradaSegura.MENSAJE_SIN_ETIQUETAS) private String tipoCuenta;
        @Size(max = 40) @Pattern(regexp = "^$|^[0-9 -]{4,40}$", message = "Escribe el número de cuenta solo con números.") private String numeroCuenta;
        @Size(max = 150) @Pattern(regexp = EntradaSegura.REGEX_SIN_ETIQUETAS, message = EntradaSegura.MENSAJE_SIN_ETIQUETAS) private String titular;
        @Size(max = 254) @Email(message = "Escribe un correo válido.") private String correoPagos;
        @Size(max = 25) @Pattern(regexp = "^$|^[+0-9 ()-]{7,25}$", message = "Escribe un teléfono válido.") private String telefonoPagos;
        @Size(max = 1000) @Pattern(regexp = EntradaSegura.REGEX_SIN_ETIQUETAS, message = EntradaSegura.MENSAJE_SIN_ETIQUETAS) private String instrucciones;
    }
}
