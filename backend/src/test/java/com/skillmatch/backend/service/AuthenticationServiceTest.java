package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.LoginRequest;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.security.TokenBlacklistService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthenticationServiceTest {

    @Mock private AuthenticationManager authenticationManager;
    @Mock private UserRepository userRepository;
    @Mock private CompanyRepository companyRepository;
    @Mock private JwtTokenProvider tokenProvider;
    @Mock private TokenBlacklistService tokenBlacklistService;

    @InjectMocks
    private AuthenticationService authenticationService;

    private User testUser;
    private Authentication mockAuth;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId("test-user-id");
        testUser.setEmail("test@skillmatch.com");
        testUser.setFirstName("Ana");
        testUser.setLastName("García");
        testUser.setRoles(List.of("USER"));

        mockAuth = mock(Authentication.class);
    }

    @Test
    void login_validCredentials_returnsAuthResponse() {
        LoginRequest request = new LoginRequest("test@skillmatch.com", "password123");

        when(authenticationManager.authenticate(any())).thenReturn(mockAuth);
        when(tokenProvider.generateToken(mockAuth)).thenReturn("mock.jwt.token");
        when(userRepository.findByEmail("test@skillmatch.com")).thenReturn(Optional.of(testUser));

        AuthResponse result = authenticationService.login(request);

        assertThat(result.getToken()).isEqualTo("mock.jwt.token");
        assertThat(result.getEmail()).isEqualTo("test@skillmatch.com");
        assertThat(result.getRole()).isEqualTo("USER");
        assertThat(result.getId()).isEqualTo("test-user-id");
    }

    @Test
    void login_badCredentials_propagatesException() {
        LoginRequest request = new LoginRequest("test@skillmatch.com", "wrong");
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Credenciales inválidas"));

        assertThatThrownBy(() -> authenticationService.login(request))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void login_userNotFoundAfterAuth_throwsResourceNotFoundException() {
        LoginRequest request = new LoginRequest("ghost@test.com", "pass");
        when(authenticationManager.authenticate(any())).thenReturn(mockAuth);
        when(tokenProvider.generateToken(mockAuth)).thenReturn("tok");
        when(userRepository.findByEmail("ghost@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authenticationService.login(request))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void login_empresaRole_includesCompanyId() {
        testUser.setRoles(List.of("EMPRESA"));

        LoginRequest request = new LoginRequest("test@skillmatch.com", "pass");
        when(authenticationManager.authenticate(any())).thenReturn(mockAuth);
        when(tokenProvider.generateToken(mockAuth)).thenReturn("tok");
        when(userRepository.findByEmail("test@skillmatch.com")).thenReturn(Optional.of(testUser));
        when(companyRepository.findByUserId("test-user-id")).thenReturn(Optional.empty());

        AuthResponse result = authenticationService.login(request);

        assertThat(result.getRole()).isEqualTo("EMPRESA");
        verify(companyRepository).findByUserId("test-user-id");
    }

    @Test
    void logout_validToken_callsBlacklist() {
        String token = "valid.jwt.token";
        Date expiry = new Date(System.currentTimeMillis() + 3600_000);
        when(tokenProvider.getExpirationFromToken(token)).thenReturn(expiry);

        authenticationService.logout(token);

        verify(tokenBlacklistService).blacklist(token, expiry.getTime());
    }

    @Test
    void logout_invalidToken_doesNotThrow() {
        when(tokenProvider.getExpirationFromToken(any())).thenThrow(new RuntimeException("token malformed"));

        assertThatCode(() -> authenticationService.logout("bad.token"))
                .doesNotThrowAnyException();
    }
}
