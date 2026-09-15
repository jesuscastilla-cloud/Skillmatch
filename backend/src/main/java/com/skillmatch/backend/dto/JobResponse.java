package com.skillmatch.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class JobResponse {

    private String id;
    private String companyId;
    private String companyName;
    private String companyLogo;
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
    private String status;
    private LocalDateTime postedDate;
    private LocalDateTime expirationDate;
    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
