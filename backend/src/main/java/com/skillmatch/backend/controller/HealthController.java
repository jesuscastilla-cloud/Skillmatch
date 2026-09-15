package com.skillmatch.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Endpoint de salud.
 *
 * Sirve para dos cosas:
 *  1. El healthcheck del hosting (Railway / Render apuntan aqui).
 *  2. Diagnosticar en un segundo si la conexion con MongoDB esta bien,
 *     sin tener que leer los logs del servidor.
 *
 * GET /api/health -> 200 si Mongo responde, 503 si no.
 */
@Tag(name = "Salud", description = "Estado de la aplicacion y de la base de datos")
@RestController
@RequestMapping("/api")
public class HealthController {

    private final MongoTemplate mongoTemplate;

    public HealthController(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Operation(summary = "Estado de la API y de MongoDB")
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("app", "SkillMatch API");
        body.put("status", "UP");

        try {
            long inicio = System.currentTimeMillis();
            mongoTemplate.executeCommand(new Document("ping", 1));
            body.put("mongodb", "UP");
            body.put("mongodbDatabase", mongoTemplate.getDb().getName());
            body.put("mongodbPingMs", System.currentTimeMillis() - inicio);
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            body.put("status", "DOWN");
            body.put("mongodb", "DOWN");
            body.put("mongodbError", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
        }
    }
}
