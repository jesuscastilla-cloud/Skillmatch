package com.skillmatch.backend.service;

import com.skillmatch.backend.exception.TooManyAttemptsException;
import com.skillmatch.backend.model.LoginAttempt;
import com.skillmatch.backend.repository.LoginAttemptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LoginAttemptServiceTest {

    private static final Instant T0 = Instant.parse("2026-10-27T15:00:00Z");

    /** Repositorio en memoria: se comporta como la colección login_attempts. */
    private final Map<String, LoginAttempt> coleccion = new HashMap<>();
    private LoginAttemptService service;

    @BeforeEach
    void setUp() {
        LoginAttemptRepository repo = mock(LoginAttemptRepository.class);
        when(repo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(coleccion.get(inv.<String>getArgument(0))));
        when(repo.save(any())).thenAnswer(inv -> {
            LoginAttempt a = inv.getArgument(0);
            coleccion.put(a.getEmailHash(), a);
            return a;
        });
        doAnswer(inv -> coleccion.remove(inv.<String>getArgument(0))).when(repo).deleteById(anyString());
        service = new LoginAttemptService(repo);
        enElMinuto(0);
    }

    @Test
    void cuatroFallos_noBloquean() {
        fallar("ana@test.com", 4);

        assertThatCode(() -> service.checkNotLocked("ana@test.com")).doesNotThrowAnyException();
    }

    @Test
    void cincoFallos_bloquean() {
        fallar("ana@test.com", 5);

        assertThatThrownBy(() -> service.checkNotLocked("ana@test.com"))
                .isInstanceOf(TooManyAttemptsException.class)
                .hasMessageContaining("15 minutos");
    }

    @Test
    void elBloqueoTermina_alos15Minutos() {
        fallar("ana@test.com", 5);

        enElMinuto(16);

        assertThatCode(() -> service.checkNotLocked("ana@test.com")).doesNotThrowAnyException();
    }

    @Test
    void mayusculasYEspacios_compartenContador() {
        fallar("Ana@Test.com ", 3);
        fallar("ana@test.com", 2);

        assertThatThrownBy(() -> service.checkNotLocked("ANA@TEST.COM"))
                .isInstanceOf(TooManyAttemptsException.class);
    }

    @Test
    void entrarBien_reiniciaElContador() {
        fallar("ana@test.com", 4);
        service.reset("ana@test.com");
        fallar("ana@test.com", 4);

        assertThatCode(() -> service.checkNotLocked("ana@test.com")).doesNotThrowAnyException();
    }

    @Test
    void noGuardaElCorreo() {
        fallar("ana@test.com", 1);

        assertThat(coleccion.keySet()).allSatisfy(k -> assertThat(k).hasSize(64).doesNotContain("ana"));
    }

    @Test
    void cuentaSinCorreo_cuentaPorSuTelefono() {
        com.skillmatch.backend.model.User soloTelefono = new com.skillmatch.backend.model.User();
        soloTelefono.setPhone("+573001234567");
        com.skillmatch.backend.model.User conCorreo = new com.skillmatch.backend.model.User();
        conCorreo.setEmail("ana@test.com");
        conCorreo.setPhone("+573001234567");

        assertThat(LoginAttemptService.claveDe(soloTelefono)).isEqualTo("+573001234567");
        assertThat(LoginAttemptService.claveDe(conCorreo)).isEqualTo("ana@test.com");
    }

    private void fallar(String email, int veces) {
        for (int i = 0; i < veces; i++) service.recordFailure(email);
    }

    private void enElMinuto(int minuto) {
        service.setClock(Clock.fixed(T0.plus(Duration.ofMinutes(minuto)), ZoneOffset.UTC));
    }
}
