package com.skillmatch.backend.model;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Un correo automatico que no salio porque se alcanzo el tope del dia (o fallo el envio).
 * Espera aqui y sale en cuanto haya cupo, primero los mas importantes. Si vence antes de salir
 * (ya no sirve), se descarta y se cuenta: no desaparece sin que nadie lo vea.
 */
@Document(collection = "correos_pendientes")
@Data
@NoArgsConstructor
public class CorreoPendiente {

    @Id
    private String id;

    private String para;
    private String asunto;
    private String texto;

    /** ALTA, MEDIA o BAJA (ver ColaCorreoService.Prioridad). */
    private String prioridad;

    /** 1 = ALTA, 2 = MEDIA, 3 = BAJA: para ordenar la cola. */
    @Indexed
    private int orden;

    private int intentos;
    private LocalDateTime createdAt;
    private LocalDateTime vence;
}
