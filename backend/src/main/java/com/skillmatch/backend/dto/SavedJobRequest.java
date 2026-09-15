package com.skillmatch.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SavedJobRequest {
    @NotBlank(message = "Job ID es requerido")
    private String jobId;

    private String notes;
}
