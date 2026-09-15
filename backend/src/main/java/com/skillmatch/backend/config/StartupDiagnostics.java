package com.skillmatch.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

/**
 * Comprueba la conexion con MongoDB en cuanto arranca la aplicacion y
 * escribe en el log un mensaje que se entiende sin saber de Spring.
 *
 * Antes, si la URI estaba mal, la aplicacion arrancaba "bien" y el error
 * solo aparecia cuando alguien intentaba hacer login, con un stacktrace
 * de 80 lineas. Ahora se ve en el primer segundo del deploy.
 */
@Slf4j
@Component
@Order(0)
public class StartupDiagnostics implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;

    @Value("${spring.data.mongodb.uri}")
    private String mongoUri;

    @Value("${server.port:8080}")
    private String puerto;

    public StartupDiagnostics(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info("================ SkillMatch ================");
        log.info("Puerto            : {}", puerto);
        log.info("MongoDB destino   : {}", ocultarCredenciales(mongoUri));
        log.info("Base de datos     : {}", mongoTemplate.getDb().getName());

        try {
            long inicio = System.currentTimeMillis();
            mongoTemplate.executeCommand(new Document("ping", 1));
            log.info("Conexion MongoDB  : OK ({} ms)", System.currentTimeMillis() - inicio);
        } catch (Exception e) {
            log.error("Conexion MongoDB  : FALLO -> {}", e.getMessage());
            log.error("Revisa estos tres puntos:");
            log.error("  1. La variable MONGODB_URI existe y empieza por mongodb:// o mongodb+srv://");
            log.error("  2. La contrasena de la URI esta codificada (@ -> %40, # -> %23, etc.)");
            log.error("  3. En MongoDB Atlas: Network Access permite 0.0.0.0/0");
        }
        log.info("Health check      : GET /api/health");
        log.info("Documentacion API : GET /swagger-ui.html");
        log.info("===========================================");
    }

    /** Nunca imprimir usuario y contrasena en los logs. */
    private String ocultarCredenciales(String uri) {
        if (uri == null) {
            return "(no configurada)";
        }
        return uri.replaceAll("://([^:@/]+):([^@]+)@", "://$1:****@");
    }
}
