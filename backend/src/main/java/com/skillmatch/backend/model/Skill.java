package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Skill {

    private String id;

    private String name;

    private String level;

    private Integer yearsOfExperience;

    private String description;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
