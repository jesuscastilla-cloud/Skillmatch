package com.skillmatch.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.InsufficientAuthenticationException;

import static org.assertj.core.api.Assertions.assertThat;

class JwtAuthenticationEntryPointTest {

    @Test
    void sinSesion_responde401EnJson() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        new JwtAuthenticationEntryPoint().commence(new MockHttpServletRequest("GET", "/api/users/me"),
                response, new InsufficientAuthenticationException("sin token"));

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getContentAsString()).contains("\"message\"");
    }
}
