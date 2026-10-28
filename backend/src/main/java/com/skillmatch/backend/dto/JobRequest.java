package com.skillmatch.backend.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class JobRequest {
    
    @NotBlank(message = "{validation.job.companyId.required}")
    private String companyId;

    @NotBlank(message = "{validation.job.title.required}")
    @Size(max = 200, message = "{validation.job.title.max}")
    private String title;

    @Size(max = 5000, message = "{validation.job.description.max}")
    private String description;

    @NotBlank(message = "{validation.job.type.required}")
    @Pattern(regexp = "empleo|práctica|freelance", message = "{validation.job.type.pattern}")
    private String type;

    @Pattern(regexp = "junior|semi-senior|senior|sin-experiencia", message = "{validation.job.level.pattern}")
    private String experienceLevel;

    @Min(value = 0, message = "{validation.job.salary.min}")
    private Double salaryMin;

    @Min(value = 0, message = "{validation.job.salary.min}")
    private Double salaryMax;

    @Size(max = 100, message = "{validation.job.location.max}")
    private String location;

    @Pattern(regexp = "presencial|remoto|híbrido", message = "{validation.job.modality.pattern}")
    private String modality;

    @Size(max = 100, message = "{validation.job.duration.max}")
    private String duration;
    
    @Size(max = 50, message = "Máximo 50 elementos por lista")
    private List<@Size(max = 500, message = "Cada elemento puede tener máximo 500 caracteres") String> requirements;
    
    @Size(max = 50, message = "Máximo 50 elementos por lista")
    private List<@Size(max = 500, message = "Cada elemento puede tener máximo 500 caracteres") String> responsibilities;
    
    @Size(max = 50, message = "Máximo 50 elementos por lista")
    private List<@Size(max = 500, message = "Cada elemento puede tener máximo 500 caracteres") String> skills;
    
    @Size(max = 50, message = "Máximo 50 elementos por lista")
    private List<@Size(max = 500, message = "Cada elemento puede tener máximo 500 caracteres") String> benefits;
    
    @FutureOrPresent(message = "{validation.job.expiration.future}")
    private LocalDateTime expirationDate;
}
