package com.skillmatch.backend.config;

import com.skillmatch.backend.validation.Telefonos;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Migración al arrancar: pasa los teléfonos guardados al formato internacional
 * E.164 ("+57 300 123 4567" -> "+573001234567").
 *
 * Si uno no es un número real, o en "users" chocaría con el de otra cuenta, no lo
 * toca y lo deja en el log. No borra nada. Sin pendientes, no hace nada.
 */
@Slf4j
@Component
@Order(4)
@RequiredArgsConstructor
public class NormalizarTelefonos implements ApplicationRunner {

    /** Teléfonos que no están ya en E.164 (+ seguido solo de dígitos). */
    private static final Criteria POR_NORMALIZAR = new Criteria().andOperator(
            Criteria.where("phone").type(2), Criteria.where("phone").not().regex("^\\+\\d{8,15}$"));

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            int usuarios = normalizar("users", true);
            int empresas = normalizar("companies", false);
            if (usuarios + empresas > 0) {
                log.info("Teléfonos pasados a formato internacional: {} cuentas, {} empresas", usuarios, empresas);
            }
        } catch (Exception e) {
            log.error("No se pudieron normalizar los teléfonos: {}", e.getMessage());
        }
    }

    private int normalizar(String coleccion, boolean unico) {
        int hechos = 0;
        int invalidos = 0;
        for (Document doc : mongoTemplate.find(new Query(POR_NORMALIZAR), Document.class, coleccion)) {
            Optional<String> nuevo = Telefonos.normalizar(doc.getString("phone"));
            if (nuevo.isEmpty()) {
                invalidos++;
                continue;
            }
            if (unico && mongoTemplate.exists(new Query(Criteria.where("phone").is(nuevo.get())
                    .and("_id").ne(doc.get("_id"))), coleccion)) {
                log.warn("Teléfono repetido al normalizar en '{}' (id {}): revisar a mano", coleccion, doc.get("_id"));
                continue;
            }
            mongoTemplate.updateFirst(new Query(Criteria.where("_id").is(doc.get("_id"))),
                    new Update().set("phone", nuevo.get()), coleccion);
            hechos++;
        }
        if (invalidos > 0) {
            log.warn("{} teléfonos en '{}' no son números reales y se dejaron como estaban", invalidos, coleccion);
        }
        return hechos;
    }
}
