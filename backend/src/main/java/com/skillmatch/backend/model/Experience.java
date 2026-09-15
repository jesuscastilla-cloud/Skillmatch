package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Experience {

    private String id;

    private String company;

    private String position;

    private LocalDate startDate;

    private LocalDate endDate;

    private Boolean isCurrent = false;

    private String description;

    private String location;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
