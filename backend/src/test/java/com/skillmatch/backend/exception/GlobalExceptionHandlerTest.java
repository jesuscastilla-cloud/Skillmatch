package com.skillmatch.backend.exception;

import com.skillmatch.backend.dto.MessageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void cuentaDesactivada_respondeIgualQueContrasenaMala() {
        ResponseEntity<?> mala = handler.handleBadCredentials(new BadCredentialsException("Bad credentials"), null);
        ResponseEntity<?> desactivada = handler.handleBadCredentials(new DisabledException("User is disabled"), null);
        ResponseEntity<?> bloqueada = handler.handleBadCredentials(new LockedException("User account is locked"), null);
        ResponseEntity<?> inexistente = handler.handleBadCredentials(
                new UsernameNotFoundException("Usuario no encontrado con email: x@y.com"), null);

        for (ResponseEntity<?> r : new ResponseEntity<?>[]{desactivada, bloqueada, inexistente}) {
            assertThat(r.getStatusCode()).isEqualTo(mala.getStatusCode());
            assertThat(((MessageResponse) r.getBody()).getMessage())
                    .isEqualTo(((MessageResponse) mala.getBody()).getMessage())
                    .doesNotContain("x@y.com");
        }
        assertThat(mala.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void demasiadosIntentos_responde429() {
        assertThat(handler.handleTooManyAttempts(new TooManyAttemptsException("Espera")).getStatusCode().value())
                .isEqualTo(429);
    }
}
