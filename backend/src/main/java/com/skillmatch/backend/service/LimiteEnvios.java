package com.skillmatch.backend.service;

import com.skillmatch.backend.exception.TooManyAttemptsException;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Límite de envíos por cuenta, contra spam y acoso: cada mensaje y cada
 * solicitud de conexión genera una notificación para quien la recibe.
 *
 * Vive en memoria: si el servidor reinicia, los contadores vuelven a cero.
 * Sirve para frenar ráfagas, no para llevar cuentas exactas.
 */
@Service
public class LimiteEnvios {

    static final int MENSAJES_POR_MINUTO = 20;
    static final int MENSAJES_POR_DIA = 500;
    static final int SOLICITUDES_POR_DIA = 30;
    private static final int MAX_CUENTAS = 10_000;

    private final Map<String, Bucket> mensajes = new ConcurrentHashMap<>();
    private final Map<String, Bucket> solicitudes = new ConcurrentHashMap<>();

    public void registrarMensaje(String userId) {
        consumir(mensajes, userId, () -> Bucket.builder()
                        .addLimit(limite(MENSAJES_POR_MINUTO, Duration.ofMinutes(1)))
                        .addLimit(limite(MENSAJES_POR_DIA, Duration.ofDays(1)))
                        .build(),
                "Estás enviando muchos mensajes seguidos. Espera un momento antes de seguir.");
    }

    public void registrarSolicitud(String userId) {
        consumir(solicitudes, userId, () -> Bucket.builder()
                        .addLimit(limite(SOLICITUDES_POR_DIA, Duration.ofDays(1)))
                        .build(),
                "Ya enviaste muchas solicitudes de conexión hoy. Podrás enviar más mañana.");
    }

    private void consumir(Map<String, Bucket> mapa, String userId, Supplier<Bucket> nuevo, String mensaje) {
        if (mapa.size() > MAX_CUENTAS) {
            mapa.clear(); // límite de memoria; en la práctica no se llega con este tamaño de sitio
        }
        if (!mapa.computeIfAbsent(userId, k -> nuevo.get()).tryConsume(1)) {
            throw new TooManyAttemptsException(mensaje);
        }
    }

    private static Bandwidth limite(int cantidad, Duration periodo) {
        return Bandwidth.builder().capacity(cantidad).refillGreedy(cantidad, periodo).build();
    }
}
