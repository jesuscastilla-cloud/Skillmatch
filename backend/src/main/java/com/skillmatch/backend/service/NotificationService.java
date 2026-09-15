package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.NotificationResponse;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.exception.UnauthorizedException;
import com.skillmatch.backend.model.Notification;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.NotificationRepository;
import com.skillmatch.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationResponse createNotification(String userId, String type, String content, String relatedId, String actionUrl) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setContent(content);
        notification.setRelatedId(relatedId);
        notification.setActionUrl(actionUrl);
        notification.setIsRead(false);
        notification.setCreatedAt(LocalDateTime.now());

        notification = notificationRepository.save(notification);
        log.debug("Notificación '{}' creada para usuario {}", type, userId);
        return mapToResponse(notification);
    }

    public void createConnectionRequestNotification(String userId, String requesterId, String connectionId) {
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        String content = requester.getFirstName() + " " + requester.getLastName() + " te ha enviado una solicitud de conexión";
        createNotification(userId, "connection_request", content, connectionId, "/pages/conexiones.html?tab=pending");
    }

    public void createConnectionAcceptedNotification(String userId, String accepterId, String connectionId) {
        User accepter = userRepository.findById(accepterId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        String content = accepter.getFirstName() + " " + accepter.getLastName() + " ha aceptado tu solicitud de conexión";
        createNotification(userId, "connection_accepted", content, connectionId, "/pages/conexiones.html");
    }

    public void createMessageNotification(String userId, String senderId, String messageId) {
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        String content = sender.getFirstName() + " " + sender.getLastName() + " te ha enviado un mensaje";
        createNotification(userId, "message", content, messageId, "/pages/mensajes.html?userId=" + senderId);
    }

    public void createApplicationUpdateNotification(String userId, String status, String applicationId, String jobTitle) {
        String label = switch (status) {
            case "accepted" -> "aceptada";
            case "rejected" -> "rechazada";
            default         -> "actualizada";
        };
        createNotification(userId, "application_update",
                "Tu aplicación para " + jobTitle + " ha sido " + label,
                applicationId, "/pages/perfil-usuario.html?tab=applications");
    }

    public void createNewJobNotification(String userId, String companyName, String jobId) {
        createNotification(userId, "new_job",
                companyName + " ha publicado una nueva oferta que podría interesarte",
                jobId, "/pages/oportunidades.html?jobId=" + jobId);
    }

    public void createApplicationReceivedNotification(String companyUserId, String userName, String applicationId, String jobTitle) {
        createNotification(companyUserId, "application_received",
                userName + " ha aplicado a tu oferta: " + jobTitle,
                applicationId, "/pages/perfil-empresa.html?tab=applicants");
    }

    public List<NotificationResponse> getUserNotifications(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<NotificationResponse> getUnreadNotifications(String userId) {
        return notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public long getUnreadCount(String userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    public List<NotificationResponse> getNotificationsByType(String userId, String type) {
        return notificationRepository.findByUserIdAndTypeOrderByCreatedAtDesc(userId, type).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public NotificationResponse markAsRead(String notificationId, String userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notificación no encontrada"));

        if (!notification.getUserId().equals(userId)) {
            throw new UnauthorizedException("No tienes permiso para marcar esta notificación");
        }

        if (!Boolean.TRUE.equals(notification.getIsRead())) {
            notification.setIsRead(true);
            notification.setReadAt(LocalDateTime.now());
            notification = notificationRepository.save(notification);
        }

        return mapToResponse(notification);
    }

    public void markAllAsRead(String userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        if (unread.isEmpty()) return;
        LocalDateTime now = LocalDateTime.now();
        unread.forEach(n -> { n.setIsRead(true); n.setReadAt(now); });
        notificationRepository.saveAll(unread);
        log.debug("{} notificaciones marcadas como leídas para usuario {}", unread.size(), userId);
    }

    public void deleteOldNotifications(String userId, int daysOld) {
        notificationRepository.deleteByUserIdAndCreatedAtBefore(userId, LocalDateTime.now().minusDays(daysOld));
        log.info("Notificaciones antiguas eliminadas para usuario {} (más de {} días)", userId, daysOld);
    }

    public void deleteNotification(String notificationId, String userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notificación no encontrada"));

        if (!notification.getUserId().equals(userId)) {
            throw new UnauthorizedException("No tienes permiso para eliminar esta notificación");
        }

        notificationRepository.delete(notification);
    }

    private NotificationResponse mapToResponse(Notification notification) {
        NotificationResponse response = new NotificationResponse();
        response.setId(notification.getId());
        response.setUserId(notification.getUserId());
        response.setType(notification.getType());
        response.setContent(notification.getContent());
        response.setRelatedId(notification.getRelatedId());
        response.setActionUrl(notification.getActionUrl());
        response.setIsRead(notification.getIsRead());
        response.setReadAt(notification.getReadAt());
        response.setCreatedAt(notification.getCreatedAt());
        return response;
    }
}
