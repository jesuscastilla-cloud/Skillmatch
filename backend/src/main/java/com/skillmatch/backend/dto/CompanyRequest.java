package com.skillmatch.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CompanyRequest {
    
    @NotBlank(message = "El nombre de la empresa es obligatorio")
    @Size(max = 200, message = "El nombre no puede exceder 200 caracteres")
    private String name;
    
    @Size(max = 5000, message = "La descripción no puede exceder 5000 caracteres")
    private String description;
    
    @Size(max = 100, message = "La industria no puede exceder 100 caracteres")
    private String industry;
    
    @Size(max = 50, message = "El tamaño debe ser: small, medium, large o enterprise")
    private String size;
    
    @NotBlank(message = "La ubicación es obligatoria")
    @Size(max = 100, message = "La ubicación no puede exceder 100 caracteres")
    private String location;
    
    @Size(max = 500, message = "La URL del logo no puede exceder 500 caracteres")
    private String logo;
    
    @Size(max = 200, message = "El sitio web no puede exceder 200 caracteres")
    private String website;
    
    @NotBlank(message = "El email es obligatorio")
    @Email(message = "El email debe ser válido")
    @Size(max = 100, message = "El email no puede exceder 100 caracteres")
    private String email;
    
    @Size(max = 20, message = "El teléfono no puede exceder 20 caracteres")
    private String phone;
    
    private Integer foundedYear;
    
    @Size(max = 2000, message = "Los beneficios no pueden exceder 2000 caracteres")
    private String benefits;
    
    private Boolean isVerified;
    
    private Boolean active;
}
