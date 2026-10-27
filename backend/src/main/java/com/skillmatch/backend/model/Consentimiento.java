package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Prueba de una autorización (Ley 1581: previa, expresa e informada).
 * Va dentro del usuario. No guarda la IP: no hace falta como prueba.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Consentimiento {

    public static final String POLITICA_DATOS = "POLITICA_DATOS";
    public static final String MAYOR_DE_EDAD = "MAYOR_DE_EDAD";

    /** Qué se aceptó: POLITICA_DATOS o MAYOR_DE_EDAD. */
    private String tipo;

    /** Versión de la política vigente al aceptar (la de politica-datos.html). */
    private String version;

    private LocalDateTime fecha;
}
