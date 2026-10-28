package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.ExperienceResponse;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.ExperienceService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ExperienceController.class)
@AutoConfigureMockMvc(addFilters = false)
class ExperienceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ExperienceService experienceService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void login() {
        User u = new User();
        u.setId("user-id-1");
        u.setEmail("ana@test.com");
        u.setRoles(List.of("USER"));
        UserDetailsImpl principal = UserDetailsImpl.build(u);
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        SecurityContextHolder.setContext(ctx);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getUserExperiences_usaElServicioInyectado() throws Exception {
        ExperienceResponse experiencia = new ExperienceResponse();
        experiencia.setId("exp-1");
        experiencia.setCompany("Puerto de Cartagena");
        when(experienceService.getUserExperiences("user-id-1")).thenReturn(List.of(experiencia));

        mockMvc.perform(get("/api/users/user-id-1/experiences"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].company").value("Puerto de Cartagena"));
    }
}
