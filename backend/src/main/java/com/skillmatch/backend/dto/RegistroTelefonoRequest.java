package com.skillmatch.backend.dto;

import com.skillmatch.backend.validation.Credenciales;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Registro de una PERSONA con su celular (sin correo). Las empresas se registran con correo. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegistroTelefonoRequest {

    @NotBlank(message = "Escribe tu número de celular")
    @Size(max = 25, message = "Ese número de teléfono no es válido")
    private String phone;

    @NotBlank(message = "{validation.password.required}")
    @Size(min = 8, max = Credenciales.MAX_CLAVE, message = "La contraseña debe tener entre 8 y 72 caracteres")
    private String password;

    @NotBlank(message = "{validation.firstName.required}")
    @Size(max = 100, message = "{validation.firstName.max}")
    private String firstName;

    @NotBlank(message = "{validation.lastName.required}")
    @Size(max = 100, message = "{validation.lastName.max}")
    private String lastName;

    private Boolean aceptaPolitica;

    private Boolean mayorDeEdad;
}
