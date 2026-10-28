package com.skillmatch.backend.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static org.assertj.core.api.Assertions.assertThat;

class AuthCookieServiceTest {

    @AfterEach
    void limpiar() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void porHttps_laCookieEsSecure() {
        String cookie = cookieParaPeticion(true);

        assertThat(cookie).contains("auth_token=jwt", "HttpOnly", "Secure", "SameSite=Lax", "Max-Age=86400");
    }

    @Test
    void porHttpLocal_laCookieNoEsSecure() {
        assertThat(cookieParaPeticion(false)).contains("HttpOnly").doesNotContain("Secure");
    }

    private String cookieParaPeticion(boolean https) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSecure(https);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        AuthCookieService service = new AuthCookieService();
        ReflectionTestUtils.setField(service, "cookieSecure", false);
        ReflectionTestUtils.setField(service, "cookieSameSite", "Lax");
        ReflectionTestUtils.setField(service, "expirationMillis", 86_400_000L);

        MockHttpServletResponse response = new MockHttpServletResponse();
        service.setAuthCookie(response, "jwt");
        return response.getHeader("Set-Cookie");
    }
}
