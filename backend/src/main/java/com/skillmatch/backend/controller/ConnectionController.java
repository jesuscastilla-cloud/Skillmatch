package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.ConnectionRequest;
import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.ConnectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/connections")
@RequiredArgsConstructor
public class ConnectionController {

    private final ConnectionService connectionService;

    @PostMapping
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> sendConnectionRequest(@Valid @RequestBody ConnectionRequest request,
                                                    @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(connectionService.sendConnectionRequest(currentUser.getId(), request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PatchMapping("/{connectionId}/accept")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> acceptConnection(@PathVariable String connectionId,
                                               @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(connectionService.acceptConnection(connectionId, currentUser.getId()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PatchMapping("/{connectionId}/reject")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> rejectConnection(@PathVariable String connectionId,
                                               @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(connectionService.rejectConnection(connectionId, currentUser.getId()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PatchMapping("/{connectionId}/block")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> blockConnection(@PathVariable String connectionId,
                                              @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            connectionService.blockConnection(connectionId, currentUser.getId());
            return ResponseEntity.ok(new MessageResponse("Conexión bloqueada exitosamente"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/my-connections")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getMyConnections(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(connectionService.getMyConnections(currentUser.getId()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/pending-requests")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getPendingRequests(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(connectionService.getPendingRequests(currentUser.getId()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/sent-requests")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getSentRequests(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(connectionService.getSentRequests(currentUser.getId()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/check/{otherUserId}")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> checkConnection(@PathVariable String otherUserId,
                                              @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            boolean isConnected = connectionService.areUsersConnected(currentUser.getId(), otherUserId);
            return ResponseEntity.ok(new ConnectionStatus(isConnected));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/count")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getConnectionsCount(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            long count = connectionService.getConnectionsCount(currentUser.getId());
            return ResponseEntity.ok(new CountResponse(count));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/suggestions")
    @PreAuthorize("hasRole('USER') or hasRole('EMPRESA')")
    public ResponseEntity<?> getSuggestions(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            List<User> suggestions = connectionService.getSuggestions(currentUser.getId());
            return ResponseEntity.ok(suggestions);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    private record ConnectionStatus(boolean isConnected) {}
    private record CountResponse(long count) {}
}
