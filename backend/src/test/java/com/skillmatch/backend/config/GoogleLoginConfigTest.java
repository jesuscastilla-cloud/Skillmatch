package com.skillmatch.backend.config;

import com.skillmatch.backend.controller.JobController;
import com.skillmatch.backend.security.GoogleLoginHandler;
import com.skillmatch.backend.security.AuthCookieService;
import com.skillmatch.backend.security.JwtAuthenticationEntryPoint;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.service.GoogleAuthService.Intencion;
import com.skillmatch.backend.service.JobService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** SecurityConfig con Google ENCENDIDO (credenciales de prueba): la ida y la vuelta. */
@WebMvcTest(controllers = JobController.class)
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, AuthCookieService.class})
@TestPropertySource(properties = {
        "app.cors.allowed-origins=http://localhost:*",
        "app.google.client-id=id-de-prueba.apps.googleusercontent.com",
        "app.google.client-secret=secreto-de-prueba"})
class GoogleLoginConfigTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private JobService jobService;
    @MockitoBean private UserDetailsService userDetailsService;
    @MockitoBean private JwtTokenProvider jwtTokenProvider;
    @MockitoBean private GoogleLoginHandler googleLoginHandler;

    @Test
    void ida_mandaAGoogleConStateNoncePkceYGuardaLaIntencion() throws Exception {
        MvcResult r = mockMvc.perform(get("/oauth2/authorization/google")
                        .param("tipo", "EMPRESA").param("acepta", "1").param("mayor", "no"))
                .andExpect(status().is3xxRedirection())
                .andReturn();

        String destino = r.getResponse().getRedirectedUrl();
        assertThat(destino).startsWith("https://accounts.google.com/o/oauth2/v2/auth?");
        Map<String, String> p = UriComponentsBuilder.fromUriString(destino).build().getQueryParams().toSingleValueMap();
        assertThat(p).containsEntry("client_id", "id-de-prueba.apps.googleusercontent.com")
                .containsEntry("response_type", "code")
                .containsEntry("code_challenge_method", "S256")
                .containsEntry("prompt", "select_account")
                .containsKeys("state", "nonce", "code_challenge");
        assertThat(p.get("scope")).contains("openid").contains("email");
        assertThat(p.get("redirect_uri")).isEqualTo("http://localhost/login/oauth2/code/google");
        assertThat(p).doesNotContainKey("client_secret");

        MockHttpSession sesion = (MockHttpSession) r.getRequest().getSession(false);
        assertThat(sesion.getAttribute("skillmatch.google.intencion")).isEqualTo(new Intencion("EMPRESA", true, false));
    }

    @Test
    void vueltaConStateInventado_vaAlManejadorDeError() throws Exception {
        mockMvc.perform(get("/login/oauth2/code/google").param("code", "robado").param("state", "inventado"));

        verify(googleLoginHandler).onAuthenticationFailure(any(), any(), argThat(e ->
                e instanceof OAuth2AuthenticationException o
                        && "authorization_request_not_found".equals(o.getError().getErrorCode())));
    }

    @Test
    void noPublicaLaPaginaDeLoginDeSpring() throws Exception {
        MvcResult r = mockMvc.perform(get("/login")).andReturn();
        assertThat(r.getResponse().getContentAsString()).doesNotContain("Login with OAuth 2.0");
    }

    @Test
    void laIdaAGoogleTieneLimiteDeIntentos() throws Exception {
        for (int i = 0; i < 20; i++) {
            mockMvc.perform(get("/oauth2/authorization/google").with(r -> { r.setRemoteAddr("203.0.113.9"); return r; }));
        }
        mockMvc.perform(get("/oauth2/authorization/google").with(r -> { r.setRemoteAddr("203.0.113.9"); return r; }))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void laApiSigueRespondiendo401EnJson() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized());
    }
}
