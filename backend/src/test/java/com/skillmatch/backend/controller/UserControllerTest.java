package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.UpdatePasswordRequest;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.security.AuthCookieService;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.CambioCorreoService;
import com.skillmatch.backend.service.DatosPersonalesService;
import com.skillmatch.backend.service.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = UserController.class)
@AutoConfigureMockMvc(addFilters = false)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private CambioCorreoService cambioCorreoService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private AuthCookieService authCookieService;

    @MockitoBean
    private DatosPersonalesService datosPersonalesService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getUserById_perfilAjeno_usaElPerfilPublico() throws Exception {
        loginAs("yo-id", "USER");
        when(userService.getPublicProfile("otra-id")).thenReturn(new HashMap<>(Map.of("id", "otra-id")));

        mockMvc.perform(get("/api/users/otra-id"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("otra-id"))
                .andExpect(jsonPath("$.email").doesNotExist());

        verify(userService, never()).getUserProfile(anyString());
    }

    @Test
    void getUserById_perfilPropio_traeCorreoYTelefono() throws Exception {
        loginAs("yo-id", "USER");
        when(userService.getUserProfile("yo-id"))
                .thenReturn(new HashMap<>(Map.of("id", "yo-id", "email", "yo@test.com", "phone", "3001234567")));

        mockMvc.perform(get("/api/users/yo-id"))
                .andExpect(jsonPath("$.email").value("yo@test.com"))
                .andExpect(jsonPath("$.phone").value("3001234567"));

        verify(userService, never()).getPublicProfile(anyString());
    }

    @Test
    void getUserById_admin_veElPerfilCompleto() throws Exception {
        loginAs("admin-id", "ADMIN");
        when(userService.getUserProfile("otra-id"))
                .thenReturn(new HashMap<>(Map.of("id", "otra-id", "email", "otra@test.com")));

        mockMvc.perform(get("/api/users/otra-id"))
                .andExpect(jsonPath("$.email").value("otra@test.com"));
    }

    @Test
    void getUserStatistics_deOtraPersona_responde403() throws Exception {
        loginAs("yo-id", "USER");

        mockMvc.perform(get("/api/users/otra-id/statistics"))
                .andExpect(status().isForbidden());

        verify(userService, never()).getUserStatistics(anyString());
    }

    @Test
    void getUserStatistics_propias_responde200() throws Exception {
        loginAs("yo-id", "USER");
        when(userService.getUserStatistics("yo-id")).thenReturn(Map.of("applicationsCount", 3L));

        mockMvc.perform(get("/api/users/yo-id/statistics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applicationsCount").value(3));
    }

    @Test
    void updatePassword_entregaTokenNuevoParaEstaSesion() throws Exception {
        loginAs("yo-id", "USER");
        User actualizado = new User();
        actualizado.setId("yo-id");
        actualizado.setEmail("yo@test.com");
        actualizado.setRoles(List.of("USER"));
        actualizado.setTokenVersion(1);
        when(userService.updatePassword(eq("yo-id"), any(UpdatePasswordRequest.class))).thenReturn(actualizado);
        when(jwtTokenProvider.generateToken(any(UserDetailsImpl.class))).thenReturn("token-nuevo");

        mockMvc.perform(put("/api/users/yo-id/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"actual-123\",\"newPassword\":\"nueva-12345\"}"))
                .andExpect(status().isOk())
                // El token nuevo va solo en la cookie; en el cuerpo, cuándo vence
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.expiresAt").exists());

        verify(authCookieService).setAuthCookie(any(), eq("token-nuevo"));
    }

    @Test
    void exportarMisDatos_soloDeLaSesion_yComoArchivo() throws Exception {
        loginAs("yo-id", "USER");
        when(datosPersonalesService.exportar("yo-id")).thenReturn(Map.of("perfil", Map.of("id", "yo-id")));

        mockMvc.perform(get("/api/users/me/export"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"mis-datos-skillmatch.json\""))
                .andExpect(jsonPath("$.perfil.id").value("yo-id"));

        verify(datosPersonalesService).exportar("yo-id");
    }

    private void loginAs(String userId, String role) {
        User u = new User();
        u.setId(userId);
        u.setEmail(userId + "@test.com");
        u.setRoles(List.of(role));
        UserDetailsImpl principal = UserDetailsImpl.build(u);
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        SecurityContextHolder.setContext(ctx);
    }
}
