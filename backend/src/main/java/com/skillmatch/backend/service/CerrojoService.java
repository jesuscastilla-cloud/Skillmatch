package com.skillmatch.backend.service;

import java.util.Date;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Supplier;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import com.skillmatch.backend.exception.OperacionEnCursoException;

/**
 * Un cerrojo guardado en MongoDB para que dos operaciones sobre lo mismo no se crucen:
 * por ejemplo, dos personas pidiendo el ultimo cupo de un horario, o una empresa enviando
 * invitaciones desde dos pestañas a la vez. Sirve aunque haya varios servidores.
 *
 * Como funciona: el cerrojo es un documento con _id = la clave. Tomarlo es un "upsert" que solo
 * coincide si el cerrojo existente ya vencio; si existe y sigue vigente, MongoDB rechaza el insert
 * por _id repetido y se espera un poco. Si un servidor se cae con el cerrojo tomado, vence solo.
 */
@Service
public class CerrojoService {

    static final String COLECCION = "cerrojos";
    private static final long DURA_MS = 15_000;     // si el trabajo se cuelga, el cerrojo vence solo
    private static final long ESPERA_MS = 10_000;   // cuanto espera un pedido antes de rendirse

    private final MongoTemplate mongo;

    public CerrojoService(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    /** Ejecuta el trabajo con el cerrojo de esa clave tomado; nadie mas con la misma clave corre a la vez. */
    public <T> T con(String clave, Supplier<T> trabajo) {
        String dueno = UUID.randomUUID().toString();
        long rendirse = System.currentTimeMillis() + ESPERA_MS;
        while (!tomar(clave, dueno)) {
            if (System.currentTimeMillis() > rendirse) {
                throw new OperacionEnCursoException("Hay otra operación en curso sobre esto. Intenta de nuevo en unos segundos.");
            }
            try {
                Thread.sleep(15 + ThreadLocalRandom.current().nextInt(25));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new OperacionEnCursoException("La operación se interrumpió. Intenta de nuevo.");
            }
        }
        try {
            return trabajo.get();
        } finally {
            mongo.remove(new Query(Criteria.where("_id").is(clave).and("dueno").is(dueno)), COLECCION);
        }
    }

    private boolean tomar(String clave, String dueno) {
        Date ahora = new Date();
        try {
            mongo.upsert(new Query(Criteria.where("_id").is(clave).and("hasta").lt(ahora)),
                    new Update().set("dueno", dueno).set("hasta", new Date(ahora.getTime() + DURA_MS)), COLECCION);
            return true;
        } catch (DuplicateKeyException e) {
            return false;       // otro lo tiene y no ha vencido
        }
    }
}
