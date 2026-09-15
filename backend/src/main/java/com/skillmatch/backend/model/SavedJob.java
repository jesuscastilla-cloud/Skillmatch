package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "saved_jobs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SavedJob {

    @Id
    private String id;

    private String userId;

    private String jobId;

    private LocalDateTime savedAt;

    private String notes;
}
