package com.skillmatch.backend.security;

import com.skillmatch.backend.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SecurityException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class JwtTokenProvider {

    private static final Logger logger = LoggerFactory.getLogger(JwtTokenProvider.class);

    @Autowired
    private JwtProperties jwtProperties;

    @Autowired
    private TokenBlacklistService tokenBlacklistService;

    private SecretKey signingKey;

    @PostConstruct
    private void init() {
        String secreto = jwtProperties.getSecret();

        // HS256 exige una clave de al menos 256 bits (32 caracteres). Si la
        // variable JWT_SECRET es mas corta, jjwt lanza WeakKeyException y la
        // aplicacion muere al arrancar con un error dificil de interpretar.
        if (secreto == null || secreto.trim().length() < 32) {
            throw new IllegalStateException(
                "La variable de entorno JWT_SECRET es obligatoria y debe tener al menos 32 caracteres. " +
                "Valor actual: " + (secreto == null ? "vacio" : secreto.trim().length() + " caracteres") + ". " +
                "Genera una con: openssl rand -base64 48");
        }

        if (jwtProperties.getExpiration() == null || jwtProperties.getExpiration() <= 0) {
            throw new IllegalStateException(
                "jwt.expiration (JWT_EXPIRATION) debe ser un numero de milisegundos mayor que 0.");
        }

        signingKey = Keys.hmacShaKeyFor(secreto.getBytes(StandardCharsets.UTF_8));
        logger.info("JWT configurado correctamente (expiracion: {} horas)",
                jwtProperties.getExpiration() / 3_600_000);
    }

    public String generateToken(Authentication authentication) {
        UserDetailsImpl user = (UserDetailsImpl) authentication.getPrincipal();
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtProperties.getExpiration());

        List<String> roles = user.getAuthorities().stream()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .collect(Collectors.toList());

        return Jwts.builder()
                .subject(user.getUsername())
                .claim("userId", user.getId())
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(signingKey)
                .compact();
    }

    public String getUsernameFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return claims.getSubject();
    }

    public String getUserIdFromJwt(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return claims.get("userId", String.class);
    }

    public long getExpirationMillis() {
        return jwtProperties.getExpiration();
    }

    public Date getExpirationFromToken(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getExpiration();
    }

    public List<String> getRolesFromJwt(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        Object rolesObj = claims.get("roles");
        if (rolesObj instanceof List<?> list) {
            return list.stream().map(Object::toString).collect(Collectors.toList());
        }
        return List.of();
    }

    public boolean validateToken(String authToken) {
        try {
            Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(authToken);
            return !tokenBlacklistService.isBlacklisted(authToken);
        } catch (SecurityException ex) {
            logger.error("Invalid JWT signature: {}", ex.getMessage(), ex);
        } catch (MalformedJwtException ex) {
            logger.error("Invalid JWT token: {}", ex.getMessage(), ex);
        } catch (ExpiredJwtException ex) {
            logger.error("Expired JWT token: {}", ex.getMessage(), ex);
        } catch (UnsupportedJwtException ex) {
            logger.error("Unsupported JWT token: {}", ex.getMessage(), ex);
        } catch (IllegalArgumentException ex) {
            logger.error("JWT claims string is empty: {}", ex.getMessage(), ex);
        }
        return false;
    }
}
