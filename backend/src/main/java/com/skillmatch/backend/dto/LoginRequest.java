package com.skillmatch.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.skillmatch.backend.validation.Credenciales;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {

    @NotBlank(message = "{validation.email.required}")
    @Email(message = "{validation.email.invalid}")
    private String email;

    // Mínimo 6 (no 8) a propósito: hubo cuentas que cambiaron su clave con la regla vieja
    @NotBlank(message = "{validation.password.required}")
    @Size(min = 6, max = Credenciales.MAX_CLAVE, message = "{validation.password.min}")
    private String password;

    /** Correo sin espacios y en minúsculas: un mismo correo, una sola cuenta. */
    public void setEmail(String email) {
        this.email = Credenciales.normalizarCorreo(email);
    }
}
