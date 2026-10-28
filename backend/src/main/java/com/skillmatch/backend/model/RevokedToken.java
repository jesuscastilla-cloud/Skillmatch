package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * Token cerrado con "Cerrar sesión". Se guarda la huella (SHA-256), no el token.
 * Un índice TTL sobre expiresAt (MongoIndexConfig) lo borra solo cuando el token
 * ya habría vencido.
 */
@Document(collection = "revoked_tokens")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RevokedToken {

    @Id
    private String tokenHash;

    private Date expiresAt;
}
