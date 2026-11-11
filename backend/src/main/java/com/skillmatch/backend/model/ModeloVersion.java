package com.skillmatch.backend.model;

import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Una version del modelo predictivo: lo que aprendio una noche, con su nota.
 * Se guardan todas (PDF, paso 4): con ellas se dibuja "Como ha ido aprendiendo".
 * Solo tiene cifras de todas las postulaciones juntas, nunca datos de una persona.
 */
@Document(collection = "modelo_versiones")
@Data
@NoArgsConstructor
public class ModeloVersion {

    @Id
    private String id;

    private LocalDateTime fecha;

    private int respondidas;

    /** "listo" o "esperando" */
    private String estado;

    private Double exactitudArbol;

    private Double exactitudFlojo;

    /** El mismo contenido que modelo-predictivo.json (lo lee la pagina). */
    private Map<String, Object> modelo;
}
