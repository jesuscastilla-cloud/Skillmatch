package com.skillmatch.backend.model;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;
import lombok.NoArgsConstructor;

/** La invitacion tal como la recibe una persona, con lo que ella respondio. */
@Document(collection = "invitaciones_candidatos")
@CompoundIndex(name = "empresa_fecha", def = "{'companyId': 1, 'createdAt': -1}")
@Data
@NoArgsConstructor
public class InvitacionCandidato {

    public enum Estado { PENDIENTE, CONFIRMADA, RECHAZADA, VENCIDA, CANCELADA }

    @Id
    private String id;

    @Indexed
    private String invitacionId;
    private String applicationId;
    @Indexed
    private String userId;
    private String companyId;
    private String jobId;

    private Estado estado = Estado.PENDIENTE;
    /** El horario que eligio (si confirmo) */
    private String horarioId;
    /** Lo que escribio al responder (opcional) */
    private String comentario;
    private LocalDateTime respondidaEn;
    private LocalDateTime recordadaEn;
    private LocalDateTime createdAt;
}
