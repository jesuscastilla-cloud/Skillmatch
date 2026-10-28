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
public class ExperienceRequest {

    @NotBlank(message = "La empresa es obligatoria")
    @Size(max = 150, message = "La empresa no puede tener más de 150 caracteres")
    private String company;

    @NotBlank(message = "El cargo es obligatorio")
    @Size(max = 150, message = "El cargo no puede tener más de 150 caracteres")
    private String position;

    @NotNull(message = "La fecha de inicio es obligatoria")
    private LocalDate startDate;

    private LocalDate endDate;

    private Boolean isCurrent = false;

    @Size(max = 2000, message = "La descripción no puede tener más de 2000 caracteres")
    private String description;

    @Size(max = 100, message = "La ubicación no puede tener más de 100 caracteres")
    private String location;
}
