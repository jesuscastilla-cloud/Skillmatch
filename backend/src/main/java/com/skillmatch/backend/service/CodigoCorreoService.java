package com.skillmatch.backend.service;

import com.skillmatch.backend.model.CodigoCorreo;
import com.skillmatch.backend.repository.CodigoCorreoRepository;
import com.skillmatch.backend.validation.Credenciales;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Códigos de 6 dígitos por correo: válidos 15 minutos, máximo 5 intentos y como
 * mucho uno nuevo por minuto. Se guarda solo la huella (SHA-256), nunca el código.
 */
@Service
@RequiredArgsConstructor
public class CodigoCorreoService {

    public static final String REGISTRO = "REGISTRO";
    public static final String RECUPERAR_CLAVE = "RECUPERAR_CLAVE";

    static final Duration VIGENCIA = Duration.ofMinutes(15);
    static final Duration ESPERA_REENVIO = Duration.ofMinutes(1);
    static final int MAX_INTENTOS = 5;

    private static final SecureRandom AZAR = new SecureRandom();

    private final CodigoCorreoRepository repository;
    private Clock clock = Clock.systemUTC();

    /**
     * Crea un código nuevo (reemplaza el anterior). Devuelve vacío si ya se envió
     * uno hace menos de un minuto: quien llama decide si avisa o calla.
     */
    public Optional<String> generar(String email, String proposito) {
        String id = id(email, proposito);
        Instant ahora = clock.instant();
        Optional<CodigoCorreo> anterior = repository.findById(id);
        if (anterior.isPresent() && anterior.get().getEnviadoEn().toInstant().plus(ESPERA_REENVIO).isAfter(ahora)) {
            return Optional.empty();
        }
        String codigo = String.format("%06d", AZAR.nextInt(1_000_000));
        repository.save(new CodigoCorreo(id, huella(id + ":" + codigo), 0,
                Date.from(ahora), Date.from(ahora.plus(VIGENCIA))));
        return Optional.of(codigo);
    }

    /** true si el código es el correcto y sigue vigente. Al acertar, el código se gasta. */
    public boolean verificar(String email, String proposito, String codigo) {
        String id = id(email, proposito);
        Optional<CodigoCorreo> guardado = repository.findById(id);
        if (guardado.isEmpty() || codigo == null) return false;
        CodigoCorreo c = guardado.get();
        if (c.getExpiresAt().toInstant().isBefore(clock.instant()) || c.getIntentos() >= MAX_INTENTOS) {
            repository.deleteById(id);
            return false;
        }
        boolean correcto = MessageDigest.isEqual(
                c.getCodigoHash().getBytes(StandardCharsets.UTF_8),
                huella(id + ":" + codigo.trim()).getBytes(StandardCharsets.UTF_8));
        if (correcto) {
            repository.deleteById(id);
            return true;
        }
        c.setIntentos(c.getIntentos() + 1);
        repository.save(c);
        return false;
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }

    private static String id(String email, String proposito) {
        return huella(proposito + ":" + Credenciales.normalizarCorreo(email));
    }

    private static String huella(String texto) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}
