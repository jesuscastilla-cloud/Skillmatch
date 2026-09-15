package com.skillmatch.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageResponse {
    private String id;
    private String senderId;
    private String senderName;
    private String senderProfileImage;
    private String receiverId;
    private String receiverName;
    private String receiverProfileImage;
    private String content;
    private Boolean isRead;
    private LocalDateTime readAt;
    private LocalDateTime sentAt;
    private String attachmentUrl;
}
