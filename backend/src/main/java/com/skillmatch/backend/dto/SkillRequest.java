package com.skillmatch.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SkillRequest {
    
    @NotBlank(message = "El nombre de la habilidad es obligatorio")
    private String name;
    
    @NotNull(message = "El nivel es obligatorio")
    @Pattern(regexp = "BASICO|INTERMEDIO|AVANZADO|EXPERTO", 
             message = "El nivel debe ser: BASICO, INTERMEDIO, AVANZADO o EXPERTO")
    private String level;
}
