package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * Código de 6 dígitos enviado por correo (registro, recuperar contraseña...).
 * Uno activo por correo y propósito. Solo se guarda la huella del código.
 * Un índice TTL sobre expiresAt lo borra al vencer (MongoIndexConfig).
 */
@Document(collection = "codigos_correo")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodigoCorreo {

    /** Huella de "propósito:correo": un código activo por correo y propósito. */
    @Id
    private String id;

    private String codigoHash;

    private int intentos;

    private Date enviadoEn;

    private Date expiresAt;
}
