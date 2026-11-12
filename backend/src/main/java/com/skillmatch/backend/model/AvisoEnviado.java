package com.skillmatch.backend.model;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Registro de los correos automaticos enviados, para no repetir: como maximo un aviso de
 * mensaje sin leer al dia por conversacion y un resumen diario por empresa (PDF).
 * Se borra solo a los 30 dias (indice TTL).
 */
@Document(collection = "avisos_correo")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AvisoEnviado {

    @Id
    private String id;

    private String userId;

    private String tipo;

    /** Que se aviso: el id de la conversacion, de la postulacion o el dia del resumen. */
    private String clave;

    @Indexed(expireAfter = "30d")
    private LocalDateTime fecha;
}
