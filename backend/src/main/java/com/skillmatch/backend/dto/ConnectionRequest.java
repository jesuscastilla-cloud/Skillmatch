package com.skillmatch.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConnectionRequest {
    @NotBlank(message = "Connected User ID es requerido")
    private String connectedUserId;

    @Size(max = 500, message = "El mensaje no puede tener más de 500 caracteres")
    private String message;
}
