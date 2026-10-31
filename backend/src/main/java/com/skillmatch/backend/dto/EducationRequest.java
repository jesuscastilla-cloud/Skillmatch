package com.skillmatch.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EducationRequest {

    @NotBlank(message = "La institución es obligatoria")
    @Size(max = 200, message = "La institución no puede tener más de 200 caracteres")
    private String school;

    @NotBlank(message = "El título es obligatorio")
    @Size(max = 200, message = "El título no puede tener más de 200 caracteres")
    private String degree;

    @Size(max = 200, message = "El área de estudio no puede tener más de 200 caracteres")
    private String fieldOfStudy;

    @NotNull(message = "La fecha de inicio es obligatoria")
    private LocalDate startDate;

    private LocalDate endDate;

    private Boolean isCurrent = false;

    @Size(max = 2000, message = "La descripción no puede tener más de 2000 caracteres")
    private String description;

    /** La primera fecha que se acepta: antes de esto es un error al escribir. */
    private static final LocalDate MAS_ANTIGUA = LocalDate.of(1950, 1, 1);

    // Un estudio puede empezar pronto (ya inscrito) y terminar años después (fecha de grado esperada)
    @JsonIgnore
    @AssertTrue(message = "La fecha de inicio debe estar entre 1950 y el próximo año.")
    public boolean isInicioValido() {
        return startDate == null || (!startDate.isBefore(MAS_ANTIGUA) && !startDate.isAfter(LocalDate.now().plusYears(1)));
    }

    @JsonIgnore
    @AssertTrue(message = "La fecha de fin no puede ser antes del inicio ni más de 10 años en el futuro.")
    public boolean isFinValido() {
        if (Boolean.TRUE.equals(isCurrent) || endDate == null) return true;
        return !endDate.isAfter(LocalDate.now().plusYears(10)) && (startDate == null || !endDate.isBefore(startDate));
    }
}
