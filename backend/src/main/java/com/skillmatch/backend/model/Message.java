package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Message {

    @Id
    private String id;

    private String senderId;

    private String receiverId;

    private String content;

    private Boolean isRead = false;

    private LocalDateTime readAt;

    private LocalDateTime sentAt;

    private String attachmentUrl;

    private Boolean deletedBySender = false;

    private Boolean deletedByReceiver = false;
}
