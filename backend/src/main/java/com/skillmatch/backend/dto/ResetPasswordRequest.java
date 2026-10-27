package com.skillmatch.backend.dto;

import com.skillmatch.backend.validation.Credenciales;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Cuerpo de "cambiar la contraseña con el código". */
@Data
@NoArgsConstructor
public class ResetPasswordRequest {

    @NotBlank(message = "{validation.email.required}")
    @Email(message = "{validation.email.invalid}")
    private String email;

    @NotBlank(message = "Escribe el código que te enviamos")
    @Pattern(regexp = "\\s*\\d{6}\\s*", message = "El código tiene 6 números")
    private String codigo;

    @NotBlank(message = "La nueva contraseña es requerida")
    @Size(min = 8, max = Credenciales.MAX_CLAVE, message = "La contraseña debe tener entre 8 y 72 caracteres")
    private String newPassword;

    public ResetPasswordRequest(String email, String codigo, String newPassword) {
        setEmail(email);
        this.codigo = codigo;
        this.newPassword = newPassword;
    }

    public void setEmail(String email) {
        this.email = Credenciales.normalizarCorreo(email);
    }
}
