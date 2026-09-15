package com.skillmatch.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SavedJobResponse {
    private String id;
    private String userId;
    private String jobId;
    private String jobTitle;
    private String companyName;
    private String jobType;
    private String location;
    private String salaryRange;
    private LocalDateTime savedAt;
    private String notes;
}
