package com.skillmatch.backend.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletRequestWrapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Limita por IP los intentos en las rutas donde se adivinan contraseñas:
 * login, registro, cambio de contraseña, códigos y la ida y vuelta a Google.
 *
 * Se configura con:
 *   app.rate-limit.enabled          (RATE_LIMIT_ENABLED)
 *   app.rate-limit.max-requests     (RATE_LIMIT_MAX)
 *   app.rate-limit.trusted-proxies  (RATE_LIMIT_TRUSTED_PROXIES)
 */
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitingFilter.class);
    private static final Duration WINDOW = Duration.ofMinutes(1);
    /** Evita que el mapa crezca sin limite si alguien ataca con muchas IPs. */
    private static final int MAX_TRACKED_IPS = 10_000;
    private static final Pattern CAMBIO_DE_CLAVE = Pattern.compile("^/api/users/[^/]+/password$");

    private final boolean enabled;
    private final int maxRequests;
    private final int trustedProxies;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public RateLimitingFilter(boolean enabled, int maxRequests, int trustedProxies) {
        this.enabled = enabled;
        this.maxRequests = maxRequests > 0 ? maxRequests : 20;
        this.trustedProxies = Math.max(trustedProxies, 0);
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        if (!enabled || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String uri = request.getRequestURI();
        boolean esRutaProtegida = uri.equals("/api/auth/login")
                || uri.startsWith("/api/auth/register")
                || uri.equals("/api/auth/forgot-password")
                || uri.equals("/api/auth/reset-password")
                || uri.startsWith("/api/auth/phone/")
                || uri.startsWith("/api/users/me/phone/")
                || uri.startsWith("/api/users/me/email/")
                || uri.startsWith("/api/auth/google/")
                || uri.startsWith("/oauth2/authorization/")
                || uri.startsWith("/login/oauth2/")
                || CAMBIO_DE_CLAVE.matcher(uri).matches();
        return !esRutaProtegida;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (buckets.size() > MAX_TRACKED_IPS) {
            liberarIpsInactivas();
        }

        String ip = resolveClientIp(request);
        Bucket bucket = buckets.computeIfAbsent(ip, k -> buildBucket());

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            // La cadena completa sirve para comprobar en Render que se cuenta la IP correcta
            log.warn("Límite de intentos para IP {} en {} (X-Forwarded-For: {})",
                    ip, request.getRequestURI(), original(request).getHeader("X-Forwarded-For"));
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                "{\"message\":\"Demasiados intentos. Espera 1 minuto antes de volver a intentarlo.\"}"
            );
        }
    }

    /**
     * Antes se vaciaba el mapa entero: un atacante con muchas IPs borraba también
     * su propio contador. Ahora solo salen las IPs con el cupo completo (inactivas).
     */
    private void liberarIpsInactivas() {
        buckets.entrySet().removeIf(e -> e.getValue().getAvailableTokens() >= maxRequests);
    }

    private Bucket buildBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(maxRequests)
                .refillGreedy(maxRequests, WINDOW)
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    /**
     * Cada proxy AGREGA al final de X-Forwarded-For la IP que vio. Lo del principio
     * lo puede escribir el visitante, así que se cuenta desde el final: con
     * trustedProxies = 1 (Render), la IP real es la última de la lista.
     *
     * Se lee de la petición ORIGINAL: con server.forward-headers-strategy=framework,
     * el ForwardedHeaderFilter de Spring corre antes, quita esta cabecera y deja como
     * getRemoteAddr() la PRIMERA IP de la lista (la que escribe el atacante).
     */
    String resolveClientIp(HttpServletRequest request) {
        HttpServletRequest original = original(request);
        String forwarded = original.getHeader("X-Forwarded-For");
        if (trustedProxies > 0 && forwarded != null && !forwarded.isBlank()) {
            String[] ips = forwarded.split(",");
            int posicion = ips.length - trustedProxies;
            if (posicion >= 0) {
                return ips[posicion].trim();
            }
        }
        return original.getRemoteAddr();
    }

    /** Quita las capas que ponen los filtros anteriores hasta llegar a la petición del servidor. */
    private static HttpServletRequest original(HttpServletRequest request) {
        ServletRequest actual = request;
        while (actual instanceof ServletRequestWrapper capa) {
            actual = capa.getRequest();
        }
        return actual instanceof HttpServletRequest http ? http : request;
    }
}
