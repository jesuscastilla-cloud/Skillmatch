package com.skillmatch.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExperienceRequest {
    
    @NotBlank(message = "La empresa es obligatoria")
    private String company;
    
    @NotBlank(message = "El cargo es obligatorio")
    private String position;
    
    @NotNull(message = "La fecha de inicio es obligatoria")
    private LocalDate startDate;
    
    private LocalDate endDate;
    
    private Boolean isCurrent = false;
    
    private String description;
    
    private String location;
}
