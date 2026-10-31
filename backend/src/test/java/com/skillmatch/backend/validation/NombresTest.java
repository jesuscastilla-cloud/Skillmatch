package com.skillmatch.backend.validation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NombresTest {

    @Test
    void nombresDePersonaReales_pasan() {
        for (String nombre : new String[]{"Ana", "María José", "María-José", "D'Angelo", "Núñez", "Müller", "Lú"}) {
            assertThat(Nombres.esNombreDePersona(nombre)).as(nombre).isTrue();
        }
    }

    @Test
    void simbolosNumerosYEmojis_noPasan() {
        for (String nombre : new String[]{"<<<###>>>", "Ana3", "Ana!", "Ana_Maria", "😀", "A", "-Ana", "Ana-", "Ana--María",
                "<script>", "ana@correo.com", "x".repeat(51)}) {
            assertThat(Nombres.esNombreDePersona(nombre)).as(nombre).isFalse();
        }
    }

    @Test
    void empresasReales_pasan() {
        for (String nombre : new String[]{"A&B S.A.S.", "Hotel 5 Estrellas", "Café Época, Ltda.", "Grupo Éxito (Cartagena)", "3M"}) {
            assertThat(Nombres.esNombreDeEmpresa(nombre)).as(nombre).isTrue();
        }
    }

    @Test
    void empresasConSimbolosRaros_noPasan() {
        for (String nombre : new String[]{"&.,", "<b>Hotel</b>", "Hotel 😀", "Hotel  #1", "-Hotel", "x".repeat(101)}) {
            assertThat(Nombres.esNombreDeEmpresa(nombre)).as(nombre).isFalse();
        }
    }

    @Test
    void limpiar_quitaInvisiblesYEspaciosDeMas() {
        assertThat(Nombres.limpiar("  María ​  José\t ")).isEqualTo("María José");
        assertThat(Nombres.limpiar(null)).isNull();
    }

    @Test
    void validarPersona_diceQueCampoFalla() {
        assertThatCode(() -> Nombres.validarPersona("Ana", "Pérez")).doesNotThrowAnyException();
        assertThatThrownBy(() -> Nombres.validarPersona("Ana#", "Pérez")).hasMessageStartingWith("El nombre");
        assertThatThrownBy(() -> Nombres.validarPersona("Ana", "P3rez")).hasMessageStartingWith("El apellido");
    }

    @Test
    void nombresDeGoogle_seAjustanEnVezDeRechazarse() {
        assertThat(Nombres.ajustarPersona("Ana 😀 María", "Usuario")).isEqualTo("Ana María");
        assertThat(Nombres.ajustarPersona("jdoe2024", "Usuario")).isEqualTo("jdoe");
        assertThat(Nombres.ajustarPersona("1234", "Usuario")).isEqualTo("Usuario");
        assertThat(Nombres.ajustarPersona(null, "")).isEmpty();
        assertThat(Nombres.ajustarPersona("a".repeat(80), "Usuario")).hasSize(50);
    }
}
