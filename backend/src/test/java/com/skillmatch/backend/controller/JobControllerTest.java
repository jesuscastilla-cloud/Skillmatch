package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.JobRequest;
import com.skillmatch.backend.dto.JobResponse;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.JobService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SuppressWarnings("null")
@WebMvcTest(controllers = JobController.class)
@AutoConfigureMockMvc(addFilters = false)
class JobControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JobService jobService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUpSecurityContext() {
        UserDetailsImpl principal = buildEmpresaPrincipal("empresa-b-user-id");
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(auth);
        SecurityContextHolder.setContext(ctx);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getAllActiveJobs_returnsPageWithOkStatus() throws Exception {
        JobResponse job = new JobResponse();
        job.setId("job-1");
        job.setTitle("Backend Developer");
        Page<JobResponse> page = new PageImpl<>(List.of(job));

        when(jobService.getAllActiveJobs(any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/jobs").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.content[0].title").value("Backend Developer"));
    }

    @Test
    void getAllActiveJobs_emptyPage_returnsOk() throws Exception {
        when(jobService.getAllActiveJobs(any(Pageable.class))).thenReturn(Page.empty());

        mockMvc.perform(get("/api/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    void getRecentJobs_returnsList() throws Exception {
        JobResponse job = new JobResponse();
        job.setId("job-2");
        job.setTitle("Frontend Developer");
        when(jobService.getRecentJobs()).thenReturn(List.of(job));

        mockMvc.perform(get("/api/jobs/recent"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Frontend Developer"));
    }

    @Test
    void getJobsByCompany_returnsListForCompany() throws Exception {
        JobResponse job = new JobResponse();
        job.setId("job-3");
        job.setTitle("Data Engineer");
        when(jobService.getJobsByCompany("5")).thenReturn(List.of(job));

        mockMvc.perform(get("/api/jobs/company/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Data Engineer"));
    }

    @Test
    void getJobById_notFound_returns404() throws Exception {
        when(jobService.getJobById("99"))
                .thenThrow(new ResourceNotFoundException("Job no encontrado con ID: 99"));

        mockMvc.perform(get("/api/jobs/99"))
                .andExpect(status().isNotFound());
    }

    @Test
    void changeStatus_wrongOwner_returnsForbidden() throws Exception {
        when(jobService.changeStatus(eq("job-a-id"), eq("CERRADA"), eq("empresa-b-user-id")))
                .thenThrow(new AccessDeniedException("No tienes permiso para modificar esta oferta"));

        mockMvc.perform(patch("/api/jobs/job-a-id/status")
                        .param("status", "CERRADA"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("No tienes permiso para modificar esta oferta"));
    }

    @Test
    void updateJob_wrongOwner_returnsForbidden() throws Exception {
        // Mínimo válido: companyId @NotBlank, title @NotBlank, type @Pattern(empleo|práctica|freelance)
        String body = "{\"companyId\":\"comp-b\",\"title\":\"Dev\",\"type\":\"empleo\"}";

        when(jobService.updateJob(eq("job-a-id"), any(JobRequest.class), eq("empresa-b-user-id")))
                .thenThrow(new AccessDeniedException("No tienes permiso para modificar esta oferta"));

        mockMvc.perform(put("/api/jobs/job-a-id")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("No tienes permiso para modificar esta oferta"));
    }

    private UserDetailsImpl buildEmpresaPrincipal(String userId) {
        User u = new User();
        u.setId(userId);
        u.setEmail(userId + "@test.com");
        u.setRoles(List.of("EMPRESA"));
        return UserDetailsImpl.build(u);
    }
}
