package com.skillmatch.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CompanyResponse {

    private String id;
    private String name;
    private String description;
    private String industry;
    private String size;
    private String location;
    private String logo;
    private String website;
    private String email;
    private String phone;
    private String userId;
    private Integer foundedYear;
    private String benefits;
    private Boolean isVerified;
    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
