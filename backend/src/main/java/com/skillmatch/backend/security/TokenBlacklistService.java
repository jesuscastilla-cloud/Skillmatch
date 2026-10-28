package com.skillmatch.backend.security;

import com.skillmatch.backend.model.RevokedToken;
import com.skillmatch.backend.repository.RevokedTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.HexFormat;

/**
 * Tokens cerrados con "Cerrar sesión".
 *
 * Antes vivían en la memoria del servidor y se perdían en cada reinicio
 * (Render se duerme tras 15 minutos sin visitas). Ahora van a MongoDB.
 */
@Service
@RequiredArgsConstructor
public class TokenBlacklistService {

    private final RevokedTokenRepository revokedTokenRepository;

    public void blacklist(String token, long expiryMillis) {
        revokedTokenRepository.save(new RevokedToken(hash(token), new Date(expiryMillis)));
    }

    public boolean isBlacklisted(String token) {
        return revokedTokenRepository.existsById(hash(token));
    }

    /** Huella irreversible: si alguien lee la colección, no obtiene tokens usables. */
    public static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}
