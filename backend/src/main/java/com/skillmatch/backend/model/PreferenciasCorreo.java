package com.skillmatch.backend.model;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Que correos quiere recibir cada cuenta (PDF: "Cada persona elige que correos recibe").
 * El id es el de la cuenta. Si no hay documento, valen los valores de abajo.
 * Los codigos de seguridad no estan aqui: esos llegan siempre.
 */
@Document(collection = "preferencias_correo")
@Data
@NoArgsConstructor
public class PreferenciasCorreo {

    public static final String RESPUESTA = "respuesta", MENSAJES = "mensajes", VACANTES = "vacantes", POSTULACIONES = "postulaciones";

    @Id
    private String userId;

    /** "La empresa respondio tu postulacion" (personas). */
    private boolean respuesta = true;

    /** "Tienes un mensaje sin leer" (personas). */
    private boolean mensajes = true;

    /** "Vacantes nuevas para ti", los lunes (personas). Opcional: apagado hasta que la persona lo pida. */
    private boolean vacantes = false;

    /** "Un candidato se postulo", resumen diario (empresas). */
    private boolean postulaciones = true;

    private LocalDateTime actualizado;

    public PreferenciasCorreo(String userId) { this.userId = userId; }

    public boolean quiere(String tipo) {
        return switch (tipo) {
            case RESPUESTA -> respuesta;
            case MENSAJES -> mensajes;
            case VACANTES -> vacantes;
            case POSTULACIONES -> postulaciones;
            default -> false;
        };
    }

    public void poner(String tipo, boolean valor) {
        switch (tipo) {
            case RESPUESTA -> respuesta = valor;
            case MENSAJES -> mensajes = valor;
            case VACANTES -> vacantes = valor;
            case POSTULACIONES -> postulaciones = valor;
            default -> throw new IllegalArgumentException("Tipo de correo desconocido: " + tipo);
        }
        actualizado = LocalDateTime.now();
    }
}
