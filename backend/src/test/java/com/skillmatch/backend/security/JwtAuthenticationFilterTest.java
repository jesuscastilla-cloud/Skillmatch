package com.skillmatch.backend.security;

import com.skillmatch.backend.model.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock private JwtTokenProvider tokenProvider;
    @Mock private UserDetailsService userDetailsService;

    @InjectMocks
    private JwtAuthenticationFilter filter;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void losRolesSalenDeLaBase_noDelToken() throws Exception {
        // El token podría decir ADMIN; en la base la cuenta solo es USER
        when(tokenProvider.validateToken("token")).thenReturn(true);
        when(tokenProvider.getUsernameFromToken("token")).thenReturn("ana@test.com");
        when(userDetailsService.loadUserByUsername("ana@test.com")).thenReturn(buildUser(true, "USER"));

        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(requestWithToken(), new MockHttpServletResponse(), chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth.getAuthorities()).extracting(GrantedAuthority::getAuthority).containsExactly("ROLE_USER");
        assertThat(chain.getRequest()).isNotNull();
        verify(tokenProvider, never()).getRolesFromJwt("token");
    }

    @Test
    void cuentaDesactivada_responde401YNoSigue() throws Exception {
        when(tokenProvider.validateToken("token")).thenReturn(true);
        when(tokenProvider.getUsernameFromToken("token")).thenReturn("ana@test.com");
        when(userDetailsService.loadUserByUsername("ana@test.com")).thenReturn(buildUser(false, "EMPRESA"));

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(requestWithToken(), response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(chain.getRequest()).isNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void tokenDeVersionAnterior_responde401() throws Exception {
        // La contraseña se cambió: la cuenta va en versión 1 y el token es de la 0
        UserDetailsImpl user = buildUser(true, "USER", 1);
        when(tokenProvider.validateToken("token")).thenReturn(true);
        when(tokenProvider.getUsernameFromToken("token")).thenReturn("ana@test.com");
        when(userDetailsService.loadUserByUsername("ana@test.com")).thenReturn(user);
        when(tokenProvider.getTokenVersionFromJwt("token")).thenReturn(0);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(requestWithToken(), response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(chain.getRequest()).isNull();
    }

    private MockHttpServletRequest requestWithToken() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/users/me");
        request.addHeader("Authorization", "Bearer token");
        return request;
    }

    private UserDetailsImpl buildUser(boolean enabled, String role) {
        return buildUser(enabled, role, 0);
    }

    private UserDetailsImpl buildUser(boolean enabled, String role, int tokenVersion) {
        User u = new User();
        u.setTokenVersion(tokenVersion);
        u.setId("user-id-1");
        u.setEmail("ana@test.com");
        u.setEnabled(enabled);
        u.setRoles(List.of(role));
        return UserDetailsImpl.build(u);
    }
}
