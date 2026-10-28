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
    void duplicadoEnLaBase_responde409SinDetalles() {
        ResponseEntity<?> r = handler.handleDuplicateKey(
                new org.springframework.dao.DuplicateKeyException("E11000 duplicate key error index: userId_1_jobId_1"));

        assertThat(r.getStatusCode().value()).isEqualTo(409);
        assertThat(((MessageResponse) r.getBody()).getMessage()).doesNotContain("E11000", "index");
    }

    @Test
    void falloDeJava_noMuestraDetallesInternos() {
        ResponseEntity<?> r = handler.handleRuntime(
                new NullPointerException("Cannot invoke \"User.getEmail()\" because \"user\" is null"), null);

        assertThat(r.getStatusCode().value()).isEqualTo(500);
        assertThat(((MessageResponse) r.getBody()).getMessage()).doesNotContain("User", "null").contains("código");
    }

    @Test
    void mensajeDeNegocio_siLlega() {
        ResponseEntity<?> r = handler.handleRuntime(
                new RuntimeException("El salario mínimo no puede ser mayor al salario máximo"), null);

        assertThat(r.getStatusCode().value()).isEqualTo(400);
        assertThat(((MessageResponse) r.getBody()).getMessage()).contains("salario mínimo");
    }

    @Test
    void errorInesperado_noMuestraDetalles() {
        ResponseEntity<?> r = handler.handleGlobal(new java.io.IOException("Connection reset by peer 10.0.0.5:27017"), null);

        assertThat(r.getStatusCode().value()).isEqualTo(500);
        assertThat(((MessageResponse) r.getBody()).getMessage()).doesNotContain("27017", "Connection");
    }

    @Test
    void demasiadosIntentos_responde429() {
        assertThat(handler.handleTooManyAttempts(new TooManyAttemptsException("Espera")).getStatusCode().value())
                .isEqualTo(429);
    }
}
