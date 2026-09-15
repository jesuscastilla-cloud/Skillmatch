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
public class EducationRequest {
    
    @NotBlank(message = "La institución es obligatoria")
    private String school;
    
    @NotBlank(message = "El título es obligatorio")
    private String degree;
    
    private String fieldOfStudy;
    
    @NotNull(message = "La fecha de inicio es obligatoria")
    private LocalDate startDate;
    
    private LocalDate endDate;
    
    private Boolean isCurrent = false;
    
    private String description;
}
