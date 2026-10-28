package com.skillmatch.backend.config;

import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.validation.Credenciales;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Migración al arrancar: pasa a minúsculas los correos guardados antes de que
 * el backend los normalizara ("Ana@x.com" y "ana@x.com" eran cuentas distintas).
 *
 * Si dos cuentas chocarían, no toca ninguna y deja un error en el log para que
 * una persona decida. Se puede correr las veces que sea: sin pendientes no hace nada.
 */
@Slf4j
@Component
@Order(3)
@RequiredArgsConstructor
public class NormalizarCorreos implements ApplicationRunner {

    /** Correos con mayúsculas o espacios al principio o al final. */
    private static final Criteria POR_NORMALIZAR = Criteria.where("email").regex("[A-Z]|^\\s|\\s$");

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            int usuarios = normalizar(User.class, "users");
            int empresas = normalizar(Company.class, "companies");
            if (usuarios + empresas > 0) {
                log.info("Correos normalizados a minúsculas: {} cuentas, {} empresas", usuarios, empresas);
            }
        } catch (Exception e) {
            // Igual que los índices: un problema aquí no debe tumbar el arranque
            log.error("No se pudieron normalizar los correos: {}", e.getMessage());
        }
    }

    private int normalizar(Class<?> tipo, String coleccion) {
        List<org.bson.Document> pendientes = mongoTemplate.find(new Query(POR_NORMALIZAR), org.bson.Document.class, coleccion);
        int hechos = 0;
        for (org.bson.Document doc : pendientes) {
            String actual = doc.getString("email");
            String nuevo = Credenciales.normalizarCorreo(actual);
            boolean choca = mongoTemplate.exists(
                    new Query(Criteria.where("email").is(nuevo).and("_id").ne(doc.get("_id"))), coleccion);
            if (choca) {
                log.error("Correo duplicado al normalizar en '{}': {} ya existe en minúsculas (id {}). Revisar a mano.",
                        coleccion, nuevo, doc.get("_id"));
                continue;
            }
            mongoTemplate.updateFirst(new Query(Criteria.where("_id").is(doc.get("_id"))),
                    new Update().set("email", nuevo), coleccion);
            hechos++;
        }
        return hechos;
    }
}
