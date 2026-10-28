package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * Puente entre la vuelta de Google y el frontend: al entrar con Google, la página de
 * login recibe un código de un solo uso y lo cambia por la sesión. Se guarda la huella
 * SHA-256 del código (no el código). Un índice TTL lo borra al minuto.
 */
@Document(collection = "canjes_google")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CanjeGoogle {

    @Id
    private String hash;

    private String userId;

    private Date expiresAt;
}
