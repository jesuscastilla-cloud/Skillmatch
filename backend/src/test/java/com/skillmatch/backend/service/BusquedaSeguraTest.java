package com.skillmatch.backend.service;

import org.junit.jupiter.api.Test;

import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class BusquedaSeguraTest {

    private static boolean encuentra(String busqueda, String texto) {
        return Pattern.compile(BusquedaSegura.literal(busqueda), Pattern.CASE_INSENSITIVE).matcher(texto).find();
    }

    @Test
    void caracteresEspeciales_seBuscanTalCual() {
        assertThat(encuentra("C++", "Desarrollador C++ junior")).isTrue();
        assertThat(encuentra("(", "Auxiliar (medio tiempo)")).isTrue();
        assertThat(encuentra("a.b", "axb")).isFalse(); // el punto ya no es "cualquier letra"
    }

    @Test
    void patronVenenoso_quedaComoTextoNormal() {
        assertThat(encuentra("(a+)+$", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!")).isFalse();
        assertThat(encuentra(".*", "cualquier cosa")).isFalse();
    }

    @Test
    void loQueMandaElFrontendViejo_daLoMismo() {
        assertThat(BusquedaSegura.literal("C\\+\\+")).isEqualTo(BusquedaSegura.literal("C++"));
        assertThat(encuentra("Turban\\.", "Turbaná")).isFalse();
        assertThat(encuentra("Turban\\.", "Turban.")).isTrue();
    }

    @Test
    void textoLargo_seRecortaA100() {
        String largo = "x".repeat(5000);
        assertThat(BusquedaSegura.literal(largo)).isEqualTo(Pattern.quote("x".repeat(100)));
    }

    @Test
    void ordenDesconocido_usaFechaDePublicacion() {
        assertThat(BusquedaSegura.campoDeOrden("salaryMax")).isEqualTo("salaryMax");
        assertThat(BusquedaSegura.campoDeOrden("password")).isEqualTo("postedDate");
        assertThat(BusquedaSegura.campoDeOrden(null)).isEqualTo("postedDate");
    }
}
