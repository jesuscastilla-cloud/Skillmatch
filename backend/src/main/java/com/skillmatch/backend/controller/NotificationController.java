package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.dto.NotificationResponse;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getUserNotifications(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            List<NotificationResponse> notifications = notificationService.getUserNotifications(currentUser.getId());
            return ResponseEntity.ok(notifications);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/unread")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getUnreadNotifications(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(notificationService.getUnreadNotifications(currentUser.getId()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/count")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getUnreadCount(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(new CountResponse(notificationService.getUnreadCount(currentUser.getId())));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/type/{type}")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getNotificationsByType(@PathVariable String type,
                                                     @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(notificationService.getNotificationsByType(currentUser.getId(), type));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PatchMapping("/{notificationId}/read")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> markAsRead(@PathVariable String notificationId,
                                         @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(notificationService.markAsRead(notificationId, currentUser.getId()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PatchMapping("/read-all")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> markAllAsRead(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            notificationService.markAllAsRead(currentUser.getId());
            return ResponseEntity.ok(new MessageResponse("Todas las notificaciones marcadas como leídas"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/cleanup/{daysOld}")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> deleteOldNotifications(@PathVariable int daysOld,
                                                     @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            notificationService.deleteOldNotifications(currentUser.getId(), daysOld);
            return ResponseEntity.ok(new MessageResponse("Notificaciones antiguas eliminadas exitosamente"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/{notificationId}")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> deleteNotification(@PathVariable String notificationId,
                                                 @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            notificationService.deleteNotification(notificationId, currentUser.getId());
            return ResponseEntity.ok(new MessageResponse("Notificación eliminada exitosamente"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    private record CountResponse(long count) {}
}
