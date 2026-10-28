package com.skillmatch.backend.security;

import com.skillmatch.backend.model.User;
import com.skillmatch.backend.service.GoogleAuthService;
import com.skillmatch.backend.service.GoogleAuthService.DatosGoogle;
import com.skillmatch.backend.service.GoogleAuthService.GoogleRechazoException;
import com.skillmatch.backend.service.GoogleAuthService.Intencion;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * La vuelta de Google (/login/oauth2/code/google), ya con la firma, el state, el
 * nonce y PKCE comprobados por Spring.
 *
 * Bien: redirige a la página de login con "#google=<código de un solo uso>".
 * Mal:  redirige con "#google-error=<motivo>".
 * Lo que va después de "#" no viaja a ningún servidor ni queda en los registros.
 */
@Slf4j
@Component
public class GoogleLoginHandler implements AuthenticationSuccessHandler, AuthenticationFailureHandler {

    private final GoogleAuthService googleAuthService;
    private final String paginaRetorno;

    public GoogleLoginHandler(GoogleAuthService googleAuthService,
                              @Value("${app.google.pagina-retorno:/pages/login.html}") String paginaRetorno) {
        this.googleAuthService = googleAuthService;
        this.paginaRetorno = paginaRetorno;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        Intencion intencion = terminarSesionTemporal(request);
        String destino;
        try {
            OidcUser google = (OidcUser) authentication.getPrincipal();
            User user = googleAuthService.entrar(new DatosGoogle(google.getSubject(), google.getEmail(),
                    google.getEmailVerified(), google.getGivenName(), google.getFamilyName(), google.getPicture()),
                    intencion);
            destino = "google=" + googleAuthService.crearCanje(user);
        } catch (GoogleRechazoException e) {
            log.info("Entrada con Google rechazada: {}", e.getMotivo());
            destino = "google-error=" + e.getMotivo();
        } catch (RuntimeException e) {
            log.error("Error al entrar con Google", e);
            destino = "google-error=error";
        }
        response.sendRedirect(paginaRetorno + "#" + destino);
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException {
        terminarSesionTemporal(request);
        String codigo = exception instanceof OAuth2AuthenticationException oauth
                ? oauth.getError().getErrorCode() : exception.getClass().getSimpleName();
        // access_denied: la persona tocó "Cancelar" en Google
        String motivo = "access_denied".equals(codigo) ? "cancelado" : "error";
        log.info("Entrada con Google fallida: {}", codigo);
        response.sendRedirect(paginaRetorno + "#google-error=" + motivo);
    }

    /**
     * La sesión del servidor solo existía para recordar el state y la intención
     * mientras la persona estaba en Google. La sesión real es el JWT.
     */
    private static Intencion terminarSesionTemporal(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        HttpSession sesion = request.getSession(false);
        if (sesion == null) {
            return Intencion.NINGUNA;
        }
        Object guardada = sesion.getAttribute(IntencionGoogleResolver.ATRIBUTO);
        sesion.invalidate();
        return guardada instanceof Intencion i ? i : Intencion.NINGUNA;
    }
}
