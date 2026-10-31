package com.skillmatch.backend.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** El token va solo en la cookie httpOnly: en el JSON del login, registro, Google o teléfono no aparece. */
class AuthResponseTest {

    @Test
    void elJsonNoTraeElToken() throws Exception {
        AuthResponse r = new AuthResponse("eyJ.secreto.firma", "u-1", "c-1", "ana@test.com", "Ana", "Pérez", "USER");
        r.setExpiresAt(123L);

        String json = new ObjectMapper().writeValueAsString(r);

        assertThat(json).doesNotContain("eyJ.secreto.firma").doesNotContain("\"token\"").doesNotContain("Bearer");
        assertThat(json).contains("\"id\":\"u-1\"").contains("\"expiresAt\":123").contains("\"role\":\"USER\"");
        assertThat(r.getToken()).isEqualTo("eyJ.secreto.firma"); // el controlador sí lo usa para la cookie
    }
}
