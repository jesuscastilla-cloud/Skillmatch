package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * Intentos fallidos de contraseña con un correo. Se guarda la huella (SHA-256)
 * del correo, no el correo. Un índice TTL sobre expiresAt (MongoIndexConfig)
 * borra el registro cuando pasan 15 minutos sin fallos.
 */
@Document(collection = "login_attempts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginAttempt {

    @Id
    private String emailHash;

    private int failures;

    private Date lockedUntil;

    private Date expiresAt;
}
