package com.skillmatch.backend.repository;

import com.skillmatch.backend.model.Notification;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface NotificationRepository extends MongoRepository<Notification, String> {

    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);

    List<Notification> findByUserIdAndIsReadFalseOrderByCreatedAtDesc(String userId);

    long countByUserIdAndIsReadFalse(String userId);

    List<Notification> findByUserIdAndTypeOrderByCreatedAtDesc(String userId, String type);

    void deleteByUserIdAndCreatedAtBefore(String userId, LocalDateTime date);
}
