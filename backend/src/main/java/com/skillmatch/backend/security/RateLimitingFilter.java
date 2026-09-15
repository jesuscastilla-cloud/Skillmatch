package com.skillmatch.backend.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limita los intentos de login/registro por IP.
 *
 * Se configura con:
 *   app.rate-limit.enabled       (RATE_LIMIT_ENABLED)
 *   app.rate-limit.max-requests  (RATE_LIMIT_MAX)
 */
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final Duration WINDOW = Duration.ofMinutes(1);
    /** Evita que el mapa crezca sin limite si alguien ataca con muchas IPs. */
    private static final int MAX_TRACKED_IPS = 10_000;

    private final boolean enabled;
    private final int maxRequests;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public RateLimitingFilter(boolean enabled, int maxRequests) {
        this.enabled = enabled;
        this.maxRequests = maxRequests > 0 ? maxRequests : 20;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        if (!enabled) {
            return true;
        }
        String uri = request.getRequestURI();
        // Solo protege login y registro, y nunca el preflight OPTIONS
        boolean esRutaProtegida = uri.equals("/api/auth/login") || uri.equals("/api/auth/register");
        boolean esPreflight = "OPTIONS".equalsIgnoreCase(request.getMethod());
        return !esRutaProtegida || esPreflight;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (buckets.size() > MAX_TRACKED_IPS) {
            buckets.clear();
        }

        String ip = resolveClientIp(request);
        Bucket bucket = buckets.computeIfAbsent(ip, k -> buildBucket());

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                "{\"message\":\"Demasiados intentos. Espera 1 minuto antes de volver a intentarlo.\"}"
            );
        }
    }

    private Bucket buildBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(maxRequests)
                .refillGreedy(maxRequests, WINDOW)
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
