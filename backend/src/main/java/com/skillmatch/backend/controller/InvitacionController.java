package com.skillmatch.backend.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.skillmatch.backend.dto.InvitacionRequest;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.InvitacionService;
import com.skillmatch.backend.validation.EntradaSegura;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;

/**
 * Invitaciones a la siguiente etapa.
 *  Empresa:   POST /api/invitaciones                 invitar a varios candidatos de una vacante
 *             GET  /api/invitaciones?jobId=          sus procesos con cifras
 *             GET  /api/invitaciones/{id}            un proceso con las respuestas
 *             POST /api/invitaciones/{id}/recordar   recordar a quienes no han respondido
 *             POST /api/invitaciones/{id}/cancelar   cancelar el proceso
 *  Persona:   GET  /api/invitaciones/mias            las invitaciones que recibio
 *             POST /api/invitaciones/respuestas/{id} confirmar un horario o decir que no puede
 */
@RestController
@RequestMapping("/api/invitaciones")
@RequiredArgsConstructor
public class InvitacionController {

    private final InvitacionService servicio;

    @PostMapping
    @PreAuthorize("hasRole('EMPRESA')")
    public ResponseEntity<Map<String, Object>> crear(@AuthenticationPrincipal UserDetailsImpl yo, @Valid @RequestBody InvitacionRequest r) {
        return ResponseEntity.status(201).body(servicio.crear(yo.getId(), r));
    }

    @GetMapping
    @PreAuthorize("hasRole('EMPRESA')")
    public List<Map<String, Object>> deLaEmpresa(@AuthenticationPrincipal UserDetailsImpl yo, @RequestParam(required = false) String jobId) {
        return servicio.deLaEmpresa(yo.getId(), jobId);
    }

    @GetMapping("/mias")
    @PreAuthorize("hasRole('USER')")
    public List<Map<String, Object>> mias(@AuthenticationPrincipal UserDetailsImpl yo) {
        return servicio.mias(yo.getId());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('EMPRESA')")
    public Map<String, Object> detalle(@AuthenticationPrincipal UserDetailsImpl yo, @PathVariable String id) {
        return servicio.detalle(yo.getId(), id);
    }

    @PostMapping("/{id}/recordar")
    @PreAuthorize("hasRole('EMPRESA')")
    public Map<String, Object> recordar(@AuthenticationPrincipal UserDetailsImpl yo, @PathVariable String id) {
        return servicio.recordar(yo.getId(), id);
    }

    @PostMapping("/{id}/cancelar")
    @PreAuthorize("hasRole('EMPRESA')")
    public Map<String, Object> cancelar(@AuthenticationPrincipal UserDetailsImpl yo, @PathVariable String id) {
        return servicio.cancelar(yo.getId(), id);
    }

    @PostMapping("/respuestas/{id}")
    @PreAuthorize("hasRole('USER')")
    public Map<String, Object> responder(@AuthenticationPrincipal UserDetailsImpl yo, @PathVariable String id, @Valid @RequestBody Respuesta r) {
        return servicio.responder(yo.getId(), id, Boolean.TRUE.equals(r.getAsiste()), r.getHorarioId(), r.getComentario());
    }

    @Data
    public static class Respuesta {
        private Boolean asiste;
        @Size(max = 40)
        private String horarioId;
        @Size(max = 300, message = "El comentario puede tener hasta 300 caracteres.")
        @Pattern(regexp = EntradaSegura.REGEX_SIN_ETIQUETAS, message = EntradaSegura.MENSAJE_SIN_ETIQUETAS)
        private String comentario;
    }
}
