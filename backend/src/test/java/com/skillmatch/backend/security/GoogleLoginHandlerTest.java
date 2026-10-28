package com.skillmatch.backend.security;

import com.skillmatch.backend.model.User;
import com.skillmatch.backend.service.GoogleAuthService;
import com.skillmatch.backend.service.GoogleAuthService.DatosGoogle;
import com.skillmatch.backend.service.GoogleAuthService.GoogleRechazoException;
import com.skillmatch.backend.service.GoogleAuthService.Intencion;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class GoogleLoginHandlerTest {

    private final GoogleAuthService google = mock(GoogleAuthService.class);
    private final GoogleLoginHandler handler = new GoogleLoginHandler(google, "/pages/login.html");

    private OAuth2AuthenticationToken vueltaDeGoogle() {
        OidcIdToken idToken = new OidcIdToken("token", Instant.now(), Instant.now().plusSeconds(60), Map.of(
                "sub", "google-123", "email", "ana@gmail.com", "email_verified", true,
                "given_name", "Ana", "family_name", "Pérez"));
        return new OAuth2AuthenticationToken(new DefaultOidcUser(List.of(), idToken), List.of(), "google");
    }

    @Test
    void bien_redirigeConElCodigoYTerminaLaSesionTemporal() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpSession sesion = new MockHttpSession();
        sesion.setAttribute(IntencionGoogleResolver.ATRIBUTO, new Intencion("EMPRESA", true, false));
        request.setSession(sesion);
        MockHttpServletResponse response = new MockHttpServletResponse();
        User u = new User();
        when(google.entrar(any(), any())).thenReturn(u);
        when(google.crearCanje(u)).thenReturn("codigo-azar");

        handler.onAuthenticationSuccess(request, response, vueltaDeGoogle());

        assertThat(response.getRedirectedUrl()).isEqualTo("/pages/login.html#google=codigo-azar");
        assertThat(sesion.isInvalid()).isTrue();
        ArgumentCaptor<DatosGoogle> datos = ArgumentCaptor.forClass(DatosGoogle.class);
        verify(google).entrar(datos.capture(), org.mockito.ArgumentMatchers.eq(new Intencion("EMPRESA", true, false)));
        assertThat(datos.getValue().googleId()).isEqualTo("google-123");
        assertThat(datos.getValue().emailVerificado()).isTrue();
    }

    @Test
    void rechazo_redirigeConElMotivo() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(google.entrar(any(), any())).thenThrow(new GoogleRechazoException("correo_no_verificado", "x"));

        handler.onAuthenticationSuccess(new MockHttpServletRequest(), response, vueltaDeGoogle());

        assertThat(response.getRedirectedUrl()).isEqualTo("/pages/login.html#google-error=correo_no_verificado");
        verify(google, never()).crearCanje(any());
    }

    @Test
    void errorInesperado_noMuestraDetalles() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(google.entrar(any(), any())).thenThrow(new IllegalStateException("detalle interno"));

        handler.onAuthenticationSuccess(new MockHttpServletRequest(), response, vueltaDeGoogle());

        assertThat(response.getRedirectedUrl()).isEqualTo("/pages/login.html#google-error=error");
    }

    @Test
    void cancelarEnGoogle_vuelveConCancelado() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationFailure(new MockHttpServletRequest(), response,
                new OAuth2AuthenticationException(new OAuth2Error("access_denied")));

        assertThat(response.getRedirectedUrl()).isEqualTo("/pages/login.html#google-error=cancelado");
    }

    @Test
    void stateFalso_vuelveConError() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationFailure(new MockHttpServletRequest(), response,
                new OAuth2AuthenticationException(new OAuth2Error("authorization_request_not_found")));

        assertThat(response.getRedirectedUrl()).isEqualTo("/pages/login.html#google-error=error");
    }
}
