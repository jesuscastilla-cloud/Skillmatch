package com.skillmatch.backend.dto;

import com.skillmatch.backend.validation.EntradaSegura;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SkillRequest {

    @NotBlank(message = "El nombre de la habilidad es obligatorio")
    @Size(max = 80, message = "La habilidad no puede tener más de 80 caracteres")
    @Pattern(regexp = EntradaSegura.REGEX_HABILIDAD, message = EntradaSegura.MENSAJE_HABILIDAD)
    private String name;

    @NotNull(message = "El nivel es obligatorio")
    @Pattern(regexp = "BASICO|INTERMEDIO|AVANZADO|EXPERTO",
             message = "El nivel debe ser: BASICO, INTERMEDIO, AVANZADO o EXPERTO")
    private String level;
}
