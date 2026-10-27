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
public class RegisterRequest {

    @NotBlank(message = "{validation.email.required}")
    @Email(regexp = Credenciales.REGEX_CORREO, message = "{validation.email.invalid}")
    @Size(max = 254, message = "{validation.email.invalid}")
    private String email;

    @NotBlank(message = "{validation.password.required}")
    @Size(min = 8, max = Credenciales.MAX_CLAVE, message = "La contraseña debe tener entre 8 y 72 caracteres")
    private String password;

    @NotBlank(message = "{validation.firstName.required}")
    @Size(max = 100, message = "{validation.firstName.max}")
    private String firstName;

    @NotBlank(message = "{validation.lastName.required}")
    @Size(max = 100, message = "{validation.lastName.max}")
    private String lastName;

    @Size(max = 20, message = "{validation.phone.max}")
    private String phone;

    @NotBlank(message = "{validation.userType.required}")
    private String userType;

    /** Correo sin espacios y en minúsculas: un mismo correo, una sola cuenta. */
    public void setEmail(String email) {
        this.email = Credenciales.normalizarCorreo(email);
    }
}
