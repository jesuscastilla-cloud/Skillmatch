package com.skillmatch.backend.service;

import com.skillmatch.backend.exception.TooManyAttemptsException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LimiteEnviosTest {

    @Test
    void mensajes_alPasarDe20PorMinuto_responde429() {
        LimiteEnvios limite = new LimiteEnvios();
        for (int i = 0; i < LimiteEnvios.MENSAJES_POR_MINUTO; i++) limite.registrarMensaje("ana");

        assertThatThrownBy(() -> limite.registrarMensaje("ana"))
                .isInstanceOf(TooManyAttemptsException.class)
                .hasMessageContaining("Espera un momento");
    }

    @Test
    void cadaCuentaTieneSuPropioCupo() {
        LimiteEnvios limite = new LimiteEnvios();
        for (int i = 0; i < LimiteEnvios.MENSAJES_POR_MINUTO; i++) limite.registrarMensaje("ana");

        assertThatCode(() -> limite.registrarMensaje("luis")).doesNotThrowAnyException();
    }

    @Test
    void solicitudes_alPasarDe30PorDia_responde429() {
        LimiteEnvios limite = new LimiteEnvios();
        for (int i = 0; i < LimiteEnvios.SOLICITUDES_POR_DIA; i++) limite.registrarSolicitud("ana");

        assertThatThrownBy(() -> limite.registrarSolicitud("ana"))
                .isInstanceOf(TooManyAttemptsException.class)
                .hasMessageContaining("mañana");
    }
}
