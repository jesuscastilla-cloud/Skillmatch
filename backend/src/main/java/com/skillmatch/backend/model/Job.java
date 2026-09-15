package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "jobs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Job {

    @Id
    private String id;

    private String companyId;

    private String title;

    private String description;

    private String type;

    private String experienceLevel;

    private Double salaryMin;

    private Double salaryMax;

    private String location;

    private String modality;

    private String duration;

    private List<String> requirements;

    private List<String> responsibilities;

    private List<String> skills;

    private List<String> benefits;

    private JobStatus status = JobStatus.ABIERTA;

    private LocalDateTime postedDate;

    private LocalDateTime expirationDate;

    private Boolean active = true;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
