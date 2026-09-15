package com.skillmatch.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "connections")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Connection {

    @Id
    private String id;

    private String userId;

    private String connectedUserId;

    private ConnectionStatus status = ConnectionStatus.PENDING;

    private LocalDateTime requestedAt;

    private LocalDateTime respondedAt;

    private String message;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
