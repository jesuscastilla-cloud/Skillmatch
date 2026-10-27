package com.skillmatch.backend.service;

import com.skillmatch.backend.exception.TooManyAttemptsException;
import com.skillmatch.backend.model.LoginAttempt;
import com.skillmatch.backend.repository.LoginAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.util.Date;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Bloqueo por cuenta contra fuerza bruta: tras MAX_FALLOS contraseñas
 * equivocadas en VENTANA, el correo queda bloqueado durante VENTANA.
 *
 * Cuenta cualquier correo, exista o no, y responde lo mismo: así el bloqueo
 * no revela qué cuentas existen.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LoginAttemptService {

    static final int MAX_FALLOS = 5;
    static final Duration VENTANA = Duration.ofMinutes(15);
    static final String MENSAJE = "Demasiados intentos con esta cuenta. Espera 15 minutos antes de volver a intentarlo.";

    private final LoginAttemptRepository repository;
    private Clock clock = Clock.systemUTC();

    /** Lanza TooManyAttemptsException si el correo está bloqueado. */
    public void checkNotLocked(String email) {
        repository.findById(hash(email)).ifPresent(intento -> {
            if (intento.getLockedUntil() != null && intento.getLockedUntil().after(ahora())) {
                throw new TooManyAttemptsException(MENSAJE);
            }
        });
    }

    public void recordFailure(String email) {
        String huella = hash(email);
        LoginAttempt intento = repository.findById(huella)
                .orElseGet(() -> new LoginAttempt(huella, 0, null, null));
        Date hasta = Date.from(clock.instant().plus(VENTANA));
        intento.setFailures(intento.getFailures() + 1);
        intento.setExpiresAt(hasta);
        if (intento.getFailures() >= MAX_FALLOS) {
            intento.setLockedUntil(hasta);
            log.warn("Cuenta bloqueada {} min tras {} intentos fallidos (huella {})",
                    VENTANA.toMinutes(), intento.getFailures(), huella.substring(0, 12));
        }
        repository.save(intento);
    }

    public void reset(String email) {
        repository.deleteById(hash(email));
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }

    private Date ahora() {
        return Date.from(clock.instant());
    }

    /** "Ana@Correo.com " y "ana@correo.com" comparten contador. */
    static String hash(String email) {
        String normalizado = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(normalizado.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}
