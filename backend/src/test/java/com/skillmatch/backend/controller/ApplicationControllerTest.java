package com.skillmatch.backend.controller;

import com.skillmatch.backend.model.User;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.ApplicationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ApplicationController.class)
@AutoConfigureMockMvc(addFilters = false)
class ApplicationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ApplicationService applicationService;

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
    void getApplicationsByJob_wrongOwner_returnsForbidden() throws Exception {
        when(applicationService.getApplicationsByJob(eq("job-a-id"), eq("empresa-b-user-id")))
                .thenThrow(new AccessDeniedException("No tienes permiso para acceder a estas postulaciones"));

        mockMvc.perform(get("/api/applications/job/job-a-id")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("No tienes permiso para acceder a estas postulaciones"));
    }

    @Test
    void updateApplicationStatus_wrongOwner_returnsForbidden() throws Exception {
        // notes llega null porque el test no envía el @RequestParam(required=false) notes
        when(applicationService.updateStatus(
                eq("app-a-id"), eq("aceptada"), isNull(), eq("empresa-b-user-id")))
                .thenThrow(new AccessDeniedException("No tienes permiso para acceder a estas postulaciones"));

        mockMvc.perform(patch("/api/applications/app-a-id/status")
                        .param("status", "aceptada"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("No tienes permiso para acceder a estas postulaciones"));
    }

    private UserDetailsImpl buildEmpresaPrincipal(String userId) {
        User u = new User();
        u.setId(userId);
        u.setEmail(userId + "@test.com");
        u.setRoles(List.of("EMPRESA"));
        return UserDetailsImpl.build(u);
    }
}
