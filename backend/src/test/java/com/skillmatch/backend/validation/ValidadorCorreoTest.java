package com.skillmatch.backend.validation;

import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class ValidadorCorreoTest {

    /** DNS de mentira: solo existen gmail.com y unicartagena.edu.co. */
    private final AtomicInteger consultas = new AtomicInteger();
    private final ValidadorCorreo validador = new ValidadorCorreo(Set.of("mailinator.com", "yopmail.com"), dominio -> {
        consultas.incrementAndGet();
        return dominio.equals("gmail.com") || dominio.equals("unicartagena.edu.co");
    });

    @Test
    void dominioReal_puedeRecibir() {
        assertThat(validador.puedeRecibir("ana@gmail.com")).isTrue();
        assertThat(validador.puedeRecibir("ana@unicartagena.edu.co")).isTrue();
    }

    @Test
    void dominioMalEscrito_noPuede() {
        assertThat(validador.puedeRecibir("ana@gmial.com")).isFalse();
    }

    @Test
    void correoDesechable_noPuede_ySinPreguntarAlDns() {
        assertThat(validador.puedeRecibir("bot@mailinator.com")).isFalse();
        assertThat(validador.puedeRecibir("bot@YOPMAIL.com")).isFalse();
        assertThat(consultas.get()).isZero();
    }

    @Test
    void laRespuestaDelDnsSeGuarda() {
        validador.puedeRecibir("ana@gmail.com");
        validador.puedeRecibir("luis@gmail.com");

        assertThat(consultas.get()).isEqualTo(1);
    }

    @Test
    void laListaRealDeDesechablesCarga() {
        assertThat(new ValidadorCorreo().puedeRecibir("bot@guerrillamail.com")).isFalse();
    }
}
