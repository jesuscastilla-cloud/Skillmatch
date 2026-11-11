package com.skillmatch.backend.controller;

import java.nio.charset.StandardCharsets;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.ModeloPredictivoService;
import com.skillmatch.backend.service.TablaEjemplosService;

import lombok.RequiredArgsConstructor;

/**
 * Modelo predictivo.
 *
 * GET /api/admin/modelo/ejemplos.csv     -> la tabla de ejemplos (CSV anonimo) para el script
 *                                           de Python. Solo ADMIN.
 * GET /api/modelo/mis-postulaciones      -> las caracteristicas de MIS postulaciones en proceso,
 *                                           para el recuadro de "Mis postulaciones". Solo USER.
 * GET /api/public/modelo                 -> lo que aprendio el modelo (la ultima version). Publico:
 *                                           solo cifras de todos juntos. Ya cubierto por /api/public/**.
 * POST /api/admin/modelo/aprender        -> volver a aprender ya, sin esperar a la noche. Solo ADMIN.
 *
 * No hace falta tocar SecurityConfig: la regla
 * ".anyRequest().authenticated()" ya pide sesion y @PreAuthorize pide el rol.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ModeloPredictivoController {

    private final TablaEjemplosService tablaEjemplosService;
    private final ModeloPredictivoService modeloPredictivoService;

    @GetMapping("/public/modelo")
    public ResponseEntity<?> modelo() {
        return ResponseEntity.ok(modeloPredictivoService.actual());
    }

    @PostMapping("/admin/modelo/aprender")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> aprender() {
        return ResponseEntity.ok(modeloPredictivoService.aprender());
    }

    @GetMapping("/admin/modelo/ejemplos.csv")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<byte[]> ejemplos() {
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"ejemplos.csv\"")
                .body(tablaEjemplosService.comoCsv().getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/modelo/mis-postulaciones")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> misPostulaciones(@AuthenticationPrincipal UserDetailsImpl actual) {
        if (actual == null) throw new AccessDeniedException("Usuario no autenticado");
        return ResponseEntity.ok(tablaEjemplosService.misPostulaciones(actual.getId()));
    }
}
