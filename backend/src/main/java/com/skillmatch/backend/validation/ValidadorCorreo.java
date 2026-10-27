package com.skillmatch.backend.validation;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import javax.naming.NameNotFoundException;
import javax.naming.NamingException;
import javax.naming.directory.Attributes;
import javax.naming.directory.InitialDirContext;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Hashtable;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * ¿Ese correo puede recibir mensajes? Se usa al registrarse y al cambiar el correo
 * (no en el login, para no dejar fuera a nadie ya registrado).
 *
 * 1. El dominio no está en la lista de desechables (correos-desechables.txt).
 * 2. El dominio existe en DNS (registro MX o, si no, A). Si el DNS no responde,
 *    se acepta: una caída de la red no debe impedir registrarse.
 */
@Slf4j
@Component
public class ValidadorCorreo {

    public static final String MENSAJE = "Ese correo no parece poder recibir mensajes. Revisa que esté bien escrito.";
    private static final Duration CACHE = Duration.ofHours(6);

    private final Set<String> desechables;
    private final Predicate<String> dominioExiste;
    private final Map<String, Respuesta> cache = new ConcurrentHashMap<>();

    private record Respuesta(boolean existe, Instant hasta) {}

    public ValidadorCorreo() {
        this(true);
    }

    /**
     * verificarDominio=false (app.correo.verificar-dominio) solo en las pruebas: no
     * dependen del DNS de internet. La lista de desechables se revisa igual.
     */
    @Autowired
    public ValidadorCorreo(@Value("${app.correo.verificar-dominio:true}") boolean verificarDominio) {
        this(cargarDesechables(), verificarDominio ? ValidadorCorreo::consultarDns : dominio -> true);
    }

    /** Para las pruebas: lista y consulta DNS propias (sin red). */
    ValidadorCorreo(Set<String> desechables, Predicate<String> dominioExiste) {
        this.desechables = desechables;
        this.dominioExiste = dominioExiste;
    }

    public boolean puedeRecibir(String email) {
        if (email == null || !email.contains("@")) return false;
        String dominio = email.substring(email.lastIndexOf('@') + 1).trim().toLowerCase(Locale.ROOT);
        if (desechables.contains(dominio)) return false;

        Respuesta enCache = cache.get(dominio);
        if (enCache != null && enCache.hasta().isAfter(Instant.now())) return enCache.existe();
        boolean existe = dominioExiste.test(dominio);
        if (cache.size() > 5_000) cache.clear();
        cache.put(dominio, new Respuesta(existe, Instant.now().plus(CACHE)));
        return existe;
    }

    /** Consulta DNS con la librería que ya trae Java (JNDI). Máximo ~3 segundos. */
    private static boolean consultarDns(String dominio) {
        Hashtable<String, String> env = new Hashtable<>();
        env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
        env.put("com.sun.jndi.dns.timeout.initial", "1500");
        env.put("com.sun.jndi.dns.timeout.retries", "1");
        try {
            InitialDirContext dns = new InitialDirContext(env);
            Attributes mx = dns.getAttributes(dominio, new String[]{"MX"});
            if (mx.get("MX") != null && mx.get("MX").size() > 0) return true;
            Attributes a = dns.getAttributes(dominio, new String[]{"A"});
            return a.get("A") != null && a.get("A").size() > 0;
        } catch (NameNotFoundException e) {
            return false; // el dominio no existe
        } catch (NamingException e) {
            log.warn("DNS no respondió para {} ({}): se acepta el correo", dominio, e.getClass().getSimpleName());
            return true;
        }
    }

    private static Set<String> cargarDesechables() {
        try (BufferedReader r = new BufferedReader(new InputStreamReader(
                new ClassPathResource("correos-desechables.txt").getInputStream(), StandardCharsets.UTF_8))) {
            return r.lines().map(String::trim).filter(l -> !l.isEmpty() && !l.startsWith("#"))
                    .map(l -> l.toLowerCase(Locale.ROOT)).collect(Collectors.toUnmodifiableSet());
        } catch (IOException e) {
            log.error("No se pudo leer correos-desechables.txt: {}", e.getMessage());
            return Set.of();
        }
    }
}
