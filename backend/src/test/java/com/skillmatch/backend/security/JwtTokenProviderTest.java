package com.skillmatch.backend.security;

import com.skillmatch.backend.config.JwtProperties;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtTokenProviderTest {

    static final String CLAVE_DE_PRUEBA = "clave-de-prueba-solo-para-tests-0123456789-abcdefghij";

    /** Crea el proveedor como lo haría Spring y ejecuta su revisión de arranque. */
    static JwtTokenProvider arrancar(String secreto, TokenBlacklistService blacklist) {
        JwtProperties props = new JwtProperties();
        props.setSecret(secreto);
        props.setExpiration(3_600_000L);
        JwtTokenProvider provider = new JwtTokenProvider();
        ReflectionTestUtils.setField(provider, "jwtProperties", props);
        ReflectionTestUtils.setField(provider, "tokenBlacklistService", blacklist);
        ReflectionTestUtils.invokeMethod(provider, "init");
        return provider;
    }

    @Test
    void sinClave_noArranca() {
        assertThatThrownBy(() -> arrancar("", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("obligatoria");
    }

    @Test
    void claveDeEjemploPublicada_noArranca() {
        assertThatThrownBy(() -> arrancar("skillmatch-secreto-solo-para-desarrollo-local-no-usar-en-produccion", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ejemplo");
        assertThatThrownBy(() -> arrancar("cambia-esto-por-una-cadena-larga-y-aleatoria-de-mas-de-32-caracteres", null))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void clavePropia_arranca() {
        assertThatCode(() -> arrancar(CLAVE_DE_PRUEBA, null)).doesNotThrowAnyException();
    }
}
