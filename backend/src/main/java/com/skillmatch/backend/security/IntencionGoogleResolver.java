package com.skillmatch.backend.security;

import com.skillmatch.backend.service.GoogleAuthService.Intencion;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

/**
 * Arma la ida a Google (/oauth2/authorization/google). Además de lo normal (state y
 * nonce al azar), agrega PKCE y que Google pregunte con qué cuenta entrar.
 *
 * Guarda en la sesión temporal lo que la persona eligió en la página:
 * ?tipo=EMPRESA&acepta=1&mayor=1 (solo se usa si la cuenta es nueva).
 */
public class IntencionGoogleResolver implements OAuth2AuthorizationRequestResolver {

    static final String ATRIBUTO = "skillmatch.google.intencion";

    private final DefaultOAuth2AuthorizationRequestResolver base;

    public IntencionGoogleResolver(ClientRegistrationRepository registros) {
        base = new DefaultOAuth2AuthorizationRequestResolver(registros, "/oauth2/authorization");
        base.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce()
                .andThen(pedido -> pedido.additionalParameters(p -> p.put("prompt", "select_account"))));
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return guardarIntencion(request, base.resolve(request));
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String registrationId) {
        return guardarIntencion(request, base.resolve(request, registrationId));
    }

    private static OAuth2AuthorizationRequest guardarIntencion(HttpServletRequest request,
                                                               OAuth2AuthorizationRequest pedido) {
        if (pedido != null) {
            String tipo = "EMPRESA".equalsIgnoreCase(request.getParameter("tipo")) ? "EMPRESA" : "USER";
            request.getSession().setAttribute(ATRIBUTO,
                    new Intencion(tipo, "1".equals(request.getParameter("acepta")), "1".equals(request.getParameter("mayor"))));
        }
        return pedido;
    }
}
