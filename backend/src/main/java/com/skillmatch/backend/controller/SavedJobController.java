package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.dto.SavedJobRequest;
import com.skillmatch.backend.dto.SavedJobResponse;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.SavedJobService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/saved-jobs")
@RequiredArgsConstructor
public class SavedJobController {

    private final SavedJobService savedJobService;

    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> saveJob(
            @Valid @RequestBody SavedJobRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(savedJobService.saveJob(requireUser(currentUser), request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/job/{jobId}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> unsaveJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            savedJobService.unsaveJob(requireUser(currentUser), jobId);
            return ResponseEntity.ok(new MessageResponse("Oferta eliminada de guardados exitosamente"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/my-saved-jobs")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getMySavedJobs(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            List<SavedJobResponse> savedJobs = savedJobService.getUserSavedJobs(requireUser(currentUser));
            return ResponseEntity.ok(savedJobs);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/check/{jobId}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> checkIfSaved(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            boolean isSaved = savedJobService.isJobSaved(requireUser(currentUser), jobId);
            return ResponseEntity.ok(new SavedStatus(isSaved));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/job-ids")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getSavedJobIds(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            List<String> jobIds = savedJobService.getSavedJobIds(requireUser(currentUser));
            return ResponseEntity.ok(jobIds);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/count")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getSavedJobsCount(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(new CountResponse(savedJobService.getSavedJobsCount(requireUser(currentUser))));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PatchMapping("/job/{jobId}/notes")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> updateNotes(
            @PathVariable String jobId,
            @RequestBody NotesRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        try {
            return ResponseEntity.ok(savedJobService.updateNotes(requireUser(currentUser), jobId, request.notes()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    private String requireUser(UserDetailsImpl currentUser) {
        if (currentUser == null) throw new AccessDeniedException("Usuario no autenticado");
        return currentUser.getId();
    }

    private record SavedStatus(boolean isSaved) {}
    private record CountResponse(long count) {}
    private record NotesRequest(String notes) {}
}
