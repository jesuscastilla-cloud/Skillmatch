package com.skillmatch.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** El código de un solo uso que la página de login recibe al volver de Google. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CanjeGoogleRequest {

    @NotBlank(message = "Falta el código")
    @Size(max = 100, message = "Código inválido")
    private String codigo;
}
