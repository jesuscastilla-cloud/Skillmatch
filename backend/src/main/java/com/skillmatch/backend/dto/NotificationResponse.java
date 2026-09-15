package com.skillmatch.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationResponse {
    private String id;
    private String userId;
    private String type;
    private String content;
    private String relatedId;
    private String actionUrl;
    private Boolean isRead;
    private LocalDateTime readAt;
    private LocalDateTime createdAt;
}
