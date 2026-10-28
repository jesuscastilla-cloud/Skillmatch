package com.skillmatch.backend.dto;

import com.skillmatch.backend.validation.Credenciales;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Correo + código de 6 números (confirmar el registro). */
@Data
@NoArgsConstructor
public class CodigoRequest {

    @NotBlank(message = "{validation.email.required}")
    @Email(message = "{validation.email.invalid}")
    private String email;

    @NotBlank(message = "Escribe el código que te enviamos")
    @Pattern(regexp = "\\s*\\d{6}\\s*", message = "El código tiene 6 números")
    private String codigo;

    public CodigoRequest(String email, String codigo) {
        setEmail(email);
        this.codigo = codigo;
    }

    public void setEmail(String email) {
        this.email = Credenciales.normalizarCorreo(email);
    }
}
