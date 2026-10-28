package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;
import java.util.List;

/**
 * Registro que espera el código del correo. Todavía NO es una cuenta: la cuenta se
 * crea al confirmar el código (no hay cuentas "a medias"). La contraseña ya va
 * cifrada con BCrypt. Un índice TTL sobre expiresAt lo borra a los 30 minutos.
 */
@Document(collection = "registros_pendientes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegistroPendiente {

    @Id
    private String email;

    private String passwordHash;

    private String firstName;

    private String lastName;

    private String phone;

    private String userType;

    private List<Consentimiento> consentimientos;

    private Date expiresAt;
}
