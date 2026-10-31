package com.skillmatch.backend.dto;

import com.skillmatch.backend.validation.EntradaSegura;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import com.skillmatch.backend.validation.Credenciales;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {

    @Size(min = 2, max = 100, message = "El nombre debe tener entre 2 y 100 caracteres")
    private String firstName;

    @Size(min = 2, max = 100, message = "El apellido debe tener entre 2 y 100 caracteres")
    private String lastName;

    @Email(regexp = Credenciales.REGEX_CORREO, message = "Email inválido")
    @Size(max = 254, message = "Email inválido")
    private String email;

    @Size(max = 20, message = "El teléfono no puede tener más de 20 caracteres")
    private String phone;

    @Size(max = 200, message = "El headline no puede tener más de 200 caracteres")
    private String headline;

    @Size(max = 100, message = "La ubicación no puede tener más de 100 caracteres")
    @Pattern(regexp = EntradaSegura.REGEX_LUGAR, message = EntradaSegura.MENSAJE_LUGAR)
    private String location;

    @Size(max = 500, message = "La biografía no puede tener más de 500 caracteres")
    private String bio;

    /** Correo sin espacios y en minúsculas: un mismo correo, una sola cuenta. */
    public void setEmail(String email) {
        this.email = Credenciales.normalizarCorreo(email);
    }
}
