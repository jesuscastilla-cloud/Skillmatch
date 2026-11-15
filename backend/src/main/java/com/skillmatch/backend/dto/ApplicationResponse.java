package com.skillmatch.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApplicationResponse {

    private String id;

    private String userId;
    private String userName;
    private String userEmail;
    private String userPhone;
    private String userHeadline;
    private String userLocation;
    private String userProfileImageUrl;

    private String jobId;
    private String jobTitle;
    private String companyName;
    /** Si la vacante sigue abierta: "Mis postulaciones" puede decir "Vacante cerrada". */
    private String jobStatus;
    private Boolean jobActive;

    private String status;
    private String resume;
    private String coverLetter;
    private String notes;
    private LocalDateTime appliedDate;
    private LocalDateTime reviewedDate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
