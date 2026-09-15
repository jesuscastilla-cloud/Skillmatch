package com.skillmatch.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConnectionResponse {
    private String id;
    private String userId;
    private String userName;
    private String userEmail;
    private String userHeadline;
    private String userProfileImage;
    private String connectedUserId;
    private String connectedUserName;
    private String connectedUserEmail;
    private String connectedUserHeadline;
    private String connectedUserProfileImage;
    private String status;
    private String message;
    private LocalDateTime requestedAt;
    private LocalDateTime respondedAt;
}
