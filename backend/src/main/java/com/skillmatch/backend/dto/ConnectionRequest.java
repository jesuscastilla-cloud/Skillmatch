package com.skillmatch.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConnectionRequest {
    @NotBlank(message = "Connected User ID es requerido")
    private String connectedUserId;

    private String message;
}
