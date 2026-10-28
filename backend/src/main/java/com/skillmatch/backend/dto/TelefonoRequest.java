package com.skillmatch.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Número de teléfono y, según la ruta, el código recibido. Lo usan pedir código,
 * entrar con código y agregar un teléfono a la cuenta (el código va vacío al pedirlo).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TelefonoRequest {

    @NotBlank(message = "Escribe tu número de celular")
    @Size(max = 25, message = "Ese número de teléfono no es válido")
    private String phone;

    @Pattern(regexp = "\\s*\\d{6}\\s*", message = "El código tiene 6 números")
    private String codigo;
}
