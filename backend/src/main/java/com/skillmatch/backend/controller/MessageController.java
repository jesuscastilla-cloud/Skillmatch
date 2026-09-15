package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.ChatMessageResponse;
import com.skillmatch.backend.dto.MessageRequest;
import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.MessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    @PostMapping
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> sendMessage(
            @Valid @RequestBody MessageRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(messageService.sendMessage(requireUser(currentUser), request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/conversation/{otherUserId}")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getConversation(
            @PathVariable(required = false) String otherUserId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            if (otherUserId == null || otherUserId.equals("undefined")) {
                return ResponseEntity.badRequest().body(new MessageResponse("ID de usuario inválido"));
            }
            List<ChatMessageResponse> messages = messageService.getConversation(requireUser(currentUser), otherUserId);
            return ResponseEntity.ok(messages);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PatchMapping("/{messageId}/read")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> markAsRead(
            @PathVariable(required = false) String messageId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            if (messageId == null || messageId.equals("undefined")) {
                return ResponseEntity.badRequest().body(new MessageResponse("ID de mensaje inválido"));
            }
            return ResponseEntity.ok(messageService.markAsRead(messageId, requireUser(currentUser)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PatchMapping("/conversation/{otherUserId}/read-all")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> markConversationAsRead(
            @PathVariable(required = false) String otherUserId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            if (otherUserId == null || otherUserId.equals("undefined")) {
                return ResponseEntity.badRequest().body(new MessageResponse("ID de usuario inválido"));
            }
            messageService.markConversationAsRead(requireUser(currentUser), otherUserId);
            return ResponseEntity.ok(new MessageResponse("Conversación marcada como leída"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/{messageId}")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> deleteMessage(
            @PathVariable(required = false) String messageId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            if (messageId == null || messageId.equals("undefined")) {
                return ResponseEntity.badRequest().body(new MessageResponse("ID de mensaje inválido"));
            }
            messageService.deleteMessage(messageId, requireUser(currentUser));
            return ResponseEntity.ok(new MessageResponse("Mensaje eliminado exitosamente"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/unread-count")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getUnreadCount(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(new CountResponse(messageService.getUnreadCount(requireUser(currentUser))));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/unread-count/{fromUserId}")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getUnreadCountFromUser(
            @PathVariable(required = false) String fromUserId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            if (fromUserId == null || fromUserId.equals("undefined")) {
                return ResponseEntity.badRequest().body(new MessageResponse("ID de usuario inválido"));
            }
            long count = messageService.getUnreadCountFromUser(requireUser(currentUser), fromUserId);
            return ResponseEntity.ok(new CountResponse(count));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/conversations")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getLastMessages(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(messageService.getLastMessages(requireUser(currentUser)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/unread-counts-by-conversation")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getUnreadCountsByConversation(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            Map<String, Long> counts = messageService.getUnreadCountsByConversation(requireUser(currentUser));
            return ResponseEntity.ok(counts);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    private String requireUser(UserDetailsImpl currentUser) {
        if (currentUser == null) throw new AccessDeniedException("Usuario no autenticado");
        return currentUser.getId();
    }

    private record CountResponse(long count) {}
}
