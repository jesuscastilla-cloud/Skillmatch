package com.skillmatch.backend.dto;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CertificationRequest {

    @NotBlank(message = "{validation.certification.name.required}")
    @Size(max = 200, message = "{validation.certification.name.max}")
    private String name;

    @NotBlank(message = "{validation.certification.issuer.required}")
    @Size(max = 200, message = "{validation.certification.issuer.max}")
    private String issuer;

    private LocalDate issueDate;

    @FutureOrPresent(message = "{validation.certification.expiration.future}")
    private LocalDate expirationDate;

    @Size(max = 100, message = "{validation.certification.credentialId.max}")
    private String credentialId;

    private String credentialUrl;

    @Size(max = 500, message = "{validation.certification.description.max}")
    private String description;
}
