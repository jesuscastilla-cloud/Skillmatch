package com.skillmatch.backend.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Una invitacion a la siguiente etapa (entrevista o evaluacion corta) que una empresa envia a
 * varias personas que se postularon a una de sus vacantes. Lo que responde cada persona vive en
 * InvitacionCandidato.
 */
@Document(collection = "invitaciones")
@Data
@NoArgsConstructor
public class Invitacion {

    public enum Tipo { ENTREVISTA, EVALUACION }
    public enum Modalidad { PRESENCIAL, VIRTUAL }
    public enum Estado { ACTIVA, CANCELADA }

    @Id
    private String id;

    @Indexed
    private String companyId;
    private String companyUserId;
    @Indexed
    private String jobId;
    private String jobTitle;

    private Tipo tipo;
    private Modalidad modalidad;
    /** Direccion (presencial) */
    private String lugar;
    /** Enlace de la reunion o de la evaluacion (virtual) */
    private String enlace;
    private String indicaciones;
    private Integer duracionMinutos;

    private List<Horario> horarios = new ArrayList<>();
    /** Hasta cuando se puede responder */
    private LocalDateTime respondeAntesDe;

    private Estado estado = Estado.ACTIVA;
    private LocalDateTime createdAt;
    private LocalDateTime canceladaEn;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Horario {
        private String id;
        private LocalDateTime inicio;
        /** Cuantas personas caben en ese horario */
        private Integer cupos;
    }
}
