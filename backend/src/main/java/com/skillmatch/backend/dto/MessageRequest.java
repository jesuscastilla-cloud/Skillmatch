package com.skillmatch.backend.dto;

import jakarta.validation.constraints.NotBlank;
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
    private String content;
    
    private String attachmentUrl;
}
