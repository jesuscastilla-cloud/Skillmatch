package com.skillmatch.backend.dto;

import jakarta.validation.constraints.NotBlank;
import com.skillmatch.backend.validation.EntradaSegura;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MessageRequest {
    @NotBlank(message = "Receiver ID es requerido")
    private String receiverId;

    @NotBlank(message = "El contenido del mensaje es requerido")
    @Size(max = 5000, message = "El mensaje no puede tener más de 5000 caracteres")
    private String content;

    @Pattern(regexp = EntradaSegura.REGEX_ENLACE, message = "El adjunto debe ser un enlace http:// o https://")
    private String attachmentUrl;
}
