package com.skillmatch.backend.dto;

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
}
