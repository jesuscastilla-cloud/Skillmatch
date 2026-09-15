package com.skillmatch.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.TextIndexDefinition;
import org.springframework.stereotype.Component;

import org.bson.Document;

@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class MongoIndexConfig implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;

    @Override
    @SuppressWarnings("null")
    public void run(ApplicationArguments args) {
        log.info("Verificando indices de MongoDB...");

        // users
        safe("users", () -> mongoTemplate.indexOps("users")
                .createIndex(new Index("email", Sort.Direction.ASC).unique()));

        // companies
        safe("companies", () -> mongoTemplate.indexOps("companies")
                .createIndex(new Index("userId", Sort.Direction.ASC)));
        safe("companies", () -> mongoTemplate.indexOps("companies")
                .createIndex(new CompoundIndexDefinition(new Document("industry", 1).append("active", 1))));

        // jobs
        safe("jobs", () -> mongoTemplate.indexOps("jobs")
                .createIndex(new Index("companyId", Sort.Direction.ASC)));
        safe("jobs", () -> mongoTemplate.indexOps("jobs")
                .createIndex(new CompoundIndexDefinition(new Document("status", 1).append("active", 1))));
        safe("jobs", () -> mongoTemplate.indexOps("jobs")
                .createIndex(TextIndexDefinition.builder().onField("title").build()));

        // applications
        safe("applications", () -> mongoTemplate.indexOps("applications")
                .createIndex(new Index("userId", Sort.Direction.ASC)));
        safe("applications", () -> mongoTemplate.indexOps("applications")
                .createIndex(new Index("jobId", Sort.Direction.ASC)));
        safe("applications", () -> mongoTemplate.indexOps("applications")
                .createIndex(new CompoundIndexDefinition(new Document("userId", 1).append("jobId", 1)).unique()));

        // messages
        safe("messages", () -> mongoTemplate.indexOps("messages")
                .createIndex(new CompoundIndexDefinition(new Document("senderId", 1).append("receiverId", 1))));

        // connections
        safe("connections", () -> mongoTemplate.indexOps("connections")
                .createIndex(new Index("userId", Sort.Direction.ASC)));
        safe("connections", () -> mongoTemplate.indexOps("connections")
                .createIndex(new Index("connectedUserId", Sort.Direction.ASC)));
        safe("connections", () -> mongoTemplate.indexOps("connections")
                .createIndex(new CompoundIndexDefinition(new Document("userId", 1).append("connectedUserId", 1)).unique()));

        // saved_jobs
        safe("saved_jobs", () -> mongoTemplate.indexOps("saved_jobs")
                .createIndex(new Index("userId", Sort.Direction.ASC)));
        safe("saved_jobs", () -> mongoTemplate.indexOps("saved_jobs")
                .createIndex(new CompoundIndexDefinition(new Document("userId", 1).append("jobId", 1)).unique()));

        // notifications
        safe("notifications", () -> mongoTemplate.indexOps("notifications")
                .createIndex(new CompoundIndexDefinition(new Document("userId", 1).append("isRead", 1))));

        log.info("Indices de MongoDB verificados.");
    }

    /**
     * Ejecuta la creacion de un indice sin tumbar la aplicacion si falla.
     *
     * Antes, cualquier error aqui (indice ya existente con otras opciones,
     * duplicados en la coleccion, usuario de Atlas sin permisos de escritura)
     * hacia que el arranque fallara y el deploy se cayera entero.
     */
    private void safe(String coleccion, Runnable accion) {
        try {
            accion.run();
        } catch (Exception e) {
            log.warn("No se pudo crear un indice en '{}': {}. La app sigue arrancando.",
                    coleccion, e.getMessage());
        }
    }
}
