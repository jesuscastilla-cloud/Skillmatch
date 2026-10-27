package com.skillmatch.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitingFilterTest {

    private static final String IP_REAL = "190.85.1.1";

    @Test
    void ipInventadaAlPrincipio_noEvitaElLimite() throws Exception {
        RateLimitingFilter filter = new RateLimitingFilter(true, 3, 1);

        // El atacante cambia la primera IP en cada intento; Render agrega la real al final
        int ultimoEstado = 0;
        for (int i = 0; i < 4; i++) {
            ultimoEstado = intentar(filter, "/api/auth/login", "10.0.0." + i + ", " + IP_REAL);
        }

        assertThat(ultimoEstado).isEqualTo(429);
    }

    @Test
    void personasDistintas_tienenCupoPropio() throws Exception {
        RateLimitingFilter filter = new RateLimitingFilter(true, 1, 1);

        assertThat(intentar(filter, "/api/auth/login", "1.1.1.1")).isEqualTo(200);
        assertThat(intentar(filter, "/api/auth/login", "2.2.2.2")).isEqualTo(200);
        assertThat(intentar(filter, "/api/auth/login", "1.1.1.1")).isEqualTo(429);
    }

    @Test
    void cambioDeContrasena_tambienTieneLimite() throws Exception {
        RateLimitingFilter filter = new RateLimitingFilter(true, 1, 1);

        intentar(filter, "/api/users/abc123/password", IP_REAL);

        assertThat(intentar(filter, "/api/users/abc123/password", IP_REAL)).isEqualTo(429);
    }

    @Test
    void otrasRutas_noSeLimitan() throws Exception {
        RateLimitingFilter filter = new RateLimitingFilter(true, 1, 1);

        intentar(filter, "/api/jobs", IP_REAL);

        assertThat(intentar(filter, "/api/jobs", IP_REAL)).isEqualTo(200);
    }

    @Test
    void sinProxy_usaLaIpDeLaConexion() {
        RateLimitingFilter filter = new RateLimitingFilter(true, 5, 0);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr("200.1.1.1");
        request.addHeader("X-Forwarded-For", "9.9.9.9");

        assertThat(filter.resolveClientIp(request)).isEqualTo("200.1.1.1");
    }

    private int intentar(RateLimitingFilter filter, String ruta, String forwardedFor) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", ruta);
        request.addHeader("X-Forwarded-For", forwardedFor);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response.getStatus();
    }
}
