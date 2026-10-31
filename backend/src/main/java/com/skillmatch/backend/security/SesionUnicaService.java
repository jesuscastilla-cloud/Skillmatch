package com.skillmatch.backend.security;

import com.skillmatch.backend.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Una sola sesión abierta por cuenta.
 *
 * Cada token lleva un identificador único (jti). Al entrar (correo, Google, teléfono,
 * registro o cambio de contraseña) ese identificador queda como la sesión activa de
 * la cuenta; JwtAuthenticationFilter rechaza los tokens con otro identificador. Así,
 * entrar en el celular cierra la sesión del computador (o de la ventana de incógnito).
 */
@Service
@RequiredArgsConstructor
public class SesionUnicaService {

    /** Atributo de la petición: el token era de una sesión que otra más nueva reemplazó. */
    public static final String ATRIBUTO_REEMPLAZADA = "skillmatch.sesionReemplazada";

    public static final String MENSAJE_REEMPLAZADA =
            "Tu sesión se cerró porque entraste desde otro dispositivo. Si no fuiste tú, inicia sesión y cambia tu contraseña.";

    private final MongoTemplate mongoTemplate;

    /** Solo ese campo: no pisa lo que otra petición esté guardando en la cuenta. */
    public void registrar(String userId, String sesionId) {
        mongoTemplate.updateFirst(new Query(Criteria.where("_id").is(userId)),
                new Update().set("sesionActiva", sesionId), User.class);
    }

    /** Sin sesión registrada (cuenta que no ha vuelto a entrar) cualquier token vale. */
    public static boolean esLaActiva(String sesionActiva, String sesionDelToken) {
        return sesionActiva == null || sesionActiva.equals(sesionDelToken);
    }
}
