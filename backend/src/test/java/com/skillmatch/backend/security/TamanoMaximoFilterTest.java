package com.skillmatch.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class TamanoMaximoFilterTest {

    @Test
    void masDe1MB_responde413SinLeerla() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/messages");
        request.setContent(new byte[(int) TamanoMaximoFilter.MAX_BYTES + 1]);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        new TamanoMaximoFilter().doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(413);
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    void unaFotoDelEditor_pasa() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/users/u1/profile-image");
        request.setContent(new byte[450 * 1024]);
        MockFilterChain chain = new MockFilterChain();

        new TamanoMaximoFilter().doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(chain.getRequest()).isNotNull();
    }
}
