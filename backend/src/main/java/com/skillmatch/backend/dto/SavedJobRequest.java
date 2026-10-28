package com.skillmatch.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SavedJobRequest {
    @NotBlank(message = "Job ID es requerido")
    private String jobId;

    @Size(max = 1000, message = "Las notas no pueden tener más de 1000 caracteres")
    private String notes;
}
