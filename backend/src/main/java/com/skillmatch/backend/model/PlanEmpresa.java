package com.skillmatch.backend.model;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * El plan de una empresa. El id es el de la empresa. Sin documento, la empresa esta en el plan
 * gratuito. El plan Profesional dura hasta vigenteHasta; despues vuelve solo al gratuito.
 */
@Document(collection = "planes_empresa")
@Data
@NoArgsConstructor
public class PlanEmpresa {

    @Id
    private String companyId;
    private String plan;
    private LocalDateTime vigenteHasta;
    private LocalDateTime activadoEn;
    /** Id de la cuenta de administrador que lo activo */
    private String activadoPor;
    private String solicitudId;

    public PlanEmpresa(String companyId) { this.companyId = companyId; }
}
