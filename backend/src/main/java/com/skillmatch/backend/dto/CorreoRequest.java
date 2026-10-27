package com.skillmatch.backend.dto;

import com.skillmatch.backend.validation.Credenciales;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Cuerpo de "Olvidé mi contraseña" y de "reenviar código": solo el correo. */
@Data
@NoArgsConstructor
public class CorreoRequest {

    @NotBlank(message = "{validation.email.required}")
    @Email(message = "{validation.email.invalid}")
    private String email;

    public CorreoRequest(String email) {
        setEmail(email);
    }

    public void setEmail(String email) {
        this.email = Credenciales.normalizarCorreo(email);
    }
}
