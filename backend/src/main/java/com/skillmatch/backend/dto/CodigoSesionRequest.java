package com.skillmatch.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Solo el código de 6 números, para cosas que se confirman con la sesión abierta (cambiar el correo). */
@Data
@NoArgsConstructor
public class CodigoSesionRequest {

    @NotBlank(message = "Escribe el código que te enviamos")
    @Pattern(regexp = "\\s*\\d{6}\\s*", message = "El código tiene 6 números")
    private String codigo;
}
