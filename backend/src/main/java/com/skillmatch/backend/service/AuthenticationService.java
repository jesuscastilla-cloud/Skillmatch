package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.LoginRequest;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.security.TokenBlacklistService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthenticationService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final JwtTokenProvider tokenProvider;
    private final TokenBlacklistService tokenBlacklistService;

    public AuthResponse login(LoginRequest loginRequest) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                loginRequest.getEmail(),
                loginRequest.getPassword()
            )
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        String jwt = tokenProvider.generateToken(authentication);

        User user = userRepository.findByEmail(loginRequest.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));

        String primaryRole = resolvePrimaryRole(user);
        String companyId = null;
        if ("EMPRESA".equalsIgnoreCase(primaryRole)) {
            companyId = companyRepository.findByUserId(user.getId())
                .map(Company::getId)
                .orElse(null);
        }

        long expiresAt = System.currentTimeMillis() + tokenProvider.getExpirationMillis();
        log.info("Login exitoso: email={}, rol={}", user.getEmail(), primaryRole);
        AuthResponse response = new AuthResponse(jwt, user.getId(), companyId, user.getEmail(),
            user.getFirstName(), user.getLastName(), primaryRole);
        response.setExpiresAt(expiresAt);
        return response;
    }

    public void logout(String token) {
        try {
            long expiryMillis = tokenProvider.getExpirationFromToken(token).getTime();
            tokenBlacklistService.blacklist(token, expiryMillis);
            log.info("Token invalidado en logout");
        } catch (Exception e) {
            log.warn("Error al invalidar token en logout: {}", e.getMessage());
        }
    }

    private String resolvePrimaryRole(User user) {
        List<String> roles = Optional.ofNullable(user.getRoles()).orElse(List.of());
        if (roles.stream().anyMatch(r -> "ADMIN".equalsIgnoreCase(r))) return "ADMIN";
        if (roles.stream().anyMatch(r -> "EMPRESA".equalsIgnoreCase(r))) return "EMPRESA";
        return roles.stream().findFirst()
                .map(String::toUpperCase)
                .orElse("USER");
    }
}
