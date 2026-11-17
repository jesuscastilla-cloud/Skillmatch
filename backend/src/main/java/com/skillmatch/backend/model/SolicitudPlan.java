package com.skillmatch.backend.model;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;
import lombok.NoArgsConstructor;

/** Una empresa pide activar un plan de pago; un administrador la aprueba o la rechaza. */
@Document(collection = "solicitudes_plan")
@Data
@NoArgsConstructor
public class SolicitudPlan {

    public enum Estado { PENDIENTE, APROBADA, RECHAZADA, CANCELADA }

    @Id
    private String id;

    @Indexed
    private String companyId;
    private String companyName;
    private String userId;

    private String plan;
    private Integer meses;
    /** Valor total en pesos al momento de pedirla (precio x meses) */
    private Long valor;

    private String contactoNombre;
    private String contactoCorreo;
    private String contactoTelefono;
    private String nota;

    @Indexed
    private Estado estado = Estado.PENDIENTE;
    private String notaAdmin;
    private String atendidaPor;
    private LocalDateTime atendidaEn;
    private LocalDateTime createdAt;
}
