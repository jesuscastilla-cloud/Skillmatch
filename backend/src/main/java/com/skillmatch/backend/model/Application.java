package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "applications")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Application {

    @Id
    private String id;

    private String userId;

    private String jobId;

    private ApplicationStatus status = ApplicationStatus.PENDIENTE;

    private String resume;

    private String coverLetter;

    private LocalDateTime appliedDate;

    private LocalDateTime reviewedDate;

    private String notes;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
