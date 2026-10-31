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
    @Mock private AuthCookieService authCookieService;

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
        when(tokenProvider.getSubjectFromToken("token")).thenReturn("ana@test.com");
        when(userDetailsService.loadUserByUsername("ana@test.com")).thenReturn(buildUser(true, "USER"));

        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(requestWithToken(), new MockHttpServletResponse(), chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth.getAuthorities()).extracting(GrantedAuthority::getAuthority).containsExactly("ROLE_USER");
        assertThat(chain.getRequest()).isNotNull();
        verify(tokenProvider, never()).getRolesFromJwt("token");
    }

    @Test
    void cuentaDesactivada_sigueSinSesion() throws Exception {
        when(tokenProvider.validateToken("token")).thenReturn(true);
        when(tokenProvider.getSubjectFromToken("token")).thenReturn("ana@test.com");
        when(userDetailsService.loadUserByUsername("ana@test.com")).thenReturn(buildUser(false, "EMPRESA"));

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(requestWithToken(), response, chain);

        // Sigue como visitante: si la ruta exige sesión, Spring responde 401 después
        assertThat(chain.getRequest()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(authCookieService, never()).clearAuthCookie(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void tokenDeVersionAnterior_sigueSinSesion() throws Exception {
        // La contraseña se cambió: la cuenta va en versión 1 y el token es de la 0
        UserDetailsImpl user = buildUser(true, "USER", 1);
        when(tokenProvider.validateToken("token")).thenReturn(true);
        when(tokenProvider.getSubjectFromToken("token")).thenReturn("ana@test.com");
        when(userDetailsService.loadUserByUsername("ana@test.com")).thenReturn(user);
        when(tokenProvider.getTokenVersionFromJwt("token")).thenReturn(0);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(requestWithToken(), response, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void sesionReemplazadaPorOtroDispositivo_sigueSinSesionYLoAnota() throws Exception {
        // La cuenta entró después en el celular: su sesión activa es "s-celular"
        User u = new User();
        u.setId("user-id-1");
        u.setEmail("ana@test.com");
        u.setEnabled(true);
        u.setRoles(java.util.List.of("USER"));
        u.setSesionActiva("s-celular");
        when(tokenProvider.validateToken("token")).thenReturn(true);
        when(tokenProvider.getSubjectFromToken("token")).thenReturn("ana@test.com");
        when(userDetailsService.loadUserByUsername("ana@test.com")).thenReturn(UserDetailsImpl.build(u));
        when(tokenProvider.getSessionIdFromJwt("token")).thenReturn("s-computador");

        MockHttpServletRequest request = requestWithToken();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        // Para que el 401 diga por qué (JwtAuthenticationEntryPoint)
        assertThat(request.getAttribute(SesionUnicaService.ATRIBUTO_REEMPLAZADA)).isEqualTo(Boolean.TRUE);
    }

    @Test
    void laSesionActiva_entra() throws Exception {
        User u = new User();
        u.setId("user-id-1");
        u.setEmail("ana@test.com");
        u.setEnabled(true);
        u.setRoles(java.util.List.of("USER"));
        u.setSesionActiva("s-celular");
        when(tokenProvider.validateToken("token")).thenReturn(true);
        when(tokenProvider.getSubjectFromToken("token")).thenReturn("ana@test.com");
        when(userDetailsService.loadUserByUsername("ana@test.com")).thenReturn(UserDetailsImpl.build(u));
        when(tokenProvider.getSessionIdFromJwt("token")).thenReturn("s-celular");

        filter.doFilter(requestWithToken(), new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
    }

    @Test
    void cookieQueYaNoVale_seBorraYLaPaginaPublicaCarga() throws Exception {
        // Después de recuperar la contraseña, el navegador sigue mandando la cookie vieja
        when(tokenProvider.validateToken("viejo")).thenThrow(new IllegalArgumentException("vencido"));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/pages/recuperar.html");
        request.setCookies(new jakarta.servlet.http.Cookie("auth_token", "viejo"));

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(200);
        verify(authCookieService).clearAuthCookie(response);
    }

    @Test
    void cookieVencidaOFalsa_tambienSeBorra() throws Exception {
        when(tokenProvider.validateToken("falso")).thenReturn(false);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/pages/index.html");
        request.setCookies(new jakarta.servlet.http.Cookie("auth_token", "falso"));

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNotNull();
        verify(authCookieService).clearAuthCookie(response);
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
