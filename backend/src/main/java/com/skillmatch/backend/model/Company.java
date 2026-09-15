package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "companies")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Company {

    @Id
    private String id;

    private String userId;

    private String name;

    private String description;

    private String industry;

    private String size;

    private String location;

    private String logo;

    private String website;

    private String email;

    private String phone;

    private Integer foundedYear;

    private String benefits;

    private Boolean isVerified = false;

    private Boolean active = true;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
