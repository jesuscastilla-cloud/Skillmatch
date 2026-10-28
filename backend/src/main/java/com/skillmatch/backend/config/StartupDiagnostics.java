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
            log.error("Pista de la clave : {}", pistaDeLaClave(mongoUri));
        }
        log.info("Health check      : GET /api/health");
        log.info("Documentacion API : GET /swagger-ui.html");
        log.info("===========================================");
    }

    /**
     * Para comparar la clave que llega con la que funciona, SIN mostrarla: largo,
     * caracteres invisibles y los primeros 8 caracteres de su SHA-256 (no permiten
     * recuperarla). En local se calcula la misma huella y se compara.
     */
    static String pistaDeLaClave(String uri) {
        if (uri == null) {
            return "(sin URI)";
        }
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("://[^:@/]+:([^@]*)@").matcher(uri);
        if (!m.find()) {
            return "la URI no tiene usuario:clave@";
        }
        // Igual que el driver: solo se decodifican los %XX (un "+" sigue siendo "+")
        String clave = java.net.URLDecoder.decode(m.group(1).replace("+", "%2B"), java.nio.charset.StandardCharsets.UTF_8);
        boolean invisibles = clave.chars().anyMatch(c -> Character.isWhitespace(c) || Character.isISOControl(c) || c > 126);
        String huella;
        try {
            byte[] h = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(clave.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            huella = java.util.HexFormat.of().formatHex(h).substring(0, 8);
        } catch (java.security.NoSuchAlgorithmException e) {
            huella = "?";
        }
        return "largo=" + clave.length()
                + ", espacios o invisibles=" + (invisibles ? "SI" : "no")
                + ", espacios al inicio/fin de la URI=" + (uri.equals(uri.strip()) ? "no" : "SI")
                + ", huella=" + huella;
    }

    /** Nunca imprimir usuario y contrasena en los logs. */
    private String ocultarCredenciales(String uri) {
        if (uri == null) {
            return "(no configurada)";
        }
        return uri.replaceAll("://([^:@/]+):([^@]+)@", "://$1:****@");
    }
}
