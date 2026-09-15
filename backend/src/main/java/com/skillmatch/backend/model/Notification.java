package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    private String id;

    private String userId;

    private String type;

    private String content;

    private String relatedId;

    private String actionUrl;

    private Boolean isRead = false;

    private LocalDateTime readAt;

    private LocalDateTime createdAt;
}
