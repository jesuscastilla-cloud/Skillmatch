package com.skillmatch.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.skillmatch.backend.validation.EntradaSegura;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Lo que manda la empresa para invitar a varios candidatos a la siguiente etapa. */
@Data
@NoArgsConstructor
public class InvitacionRequest {

    @NotBlank(message = "Falta la vacante")
    private String jobId;

    @NotEmpty(message = "Elige al menos un candidato.")
    @Size(max = 50, message = "Puedes invitar hasta 50 candidatos en cada envío.")
    private List<@NotBlank String> applicationIds;

    @NotBlank(message = "Elige si es una entrevista o una evaluación.")
    @Pattern(regexp = "ENTREVISTA|EVALUACION", message = "Elige si es una entrevista o una evaluación.")
    private String tipo;

    @NotBlank(message = "Elige si es presencial o virtual.")
    @Pattern(regexp = "PRESENCIAL|VIRTUAL", message = "Elige si es presencial o virtual.")
    private String modalidad;

    @Size(max = 200, message = "La dirección puede tener hasta 200 caracteres.")
    @Pattern(regexp = EntradaSegura.REGEX_SIN_ETIQUETAS, message = EntradaSegura.MENSAJE_SIN_ETIQUETAS)
    private String lugar;

    @Pattern(regexp = EntradaSegura.REGEX_ENLACE, message = "El enlace debe empezar por https:// o http://")
    private String enlace;

    @Size(max = 1000, message = "Las indicaciones pueden tener hasta 1000 caracteres.")
    @Pattern(regexp = EntradaSegura.REGEX_SIN_ETIQUETAS, message = EntradaSegura.MENSAJE_SIN_ETIQUETAS)
    private String indicaciones;

    @Min(value = 15, message = "La duración debe ser de al menos 15 minutos.")
    @Max(value = 240, message = "La duración puede ser de hasta 4 horas.")
    private Integer duracionMinutos;

    @NotEmpty(message = "Propón al menos un horario.")
    @Size(max = 8, message = "Puedes proponer hasta 8 horarios.")
    private List<@Valid HorarioRequest> horarios;

    /** Si no llega, se puede responder hasta 2 horas antes del primer horario. */
    private LocalDateTime respondeAntesDe;

    @Data
    @NoArgsConstructor
    public static class HorarioRequest {
        @NotNull(message = "Falta la fecha y hora de un horario.")
        private LocalDateTime inicio;

        @NotNull(message = "Indica cuántas personas caben en cada horario.")
        @Min(value = 1, message = "Cada horario debe tener al menos 1 cupo.")
        @Max(value = 50, message = "Cada horario puede tener hasta 50 cupos.")
        private Integer cupos;
    }
}
