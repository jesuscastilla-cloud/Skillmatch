package com.skillmatch.backend.validation;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Las mismas reglas de la página (perfil-empresa.js, revisarVacante), ahora en el servidor. */
class RevisionVacanteTest {

    private static String revisar(String texto) {
        return RevisionVacante.problemasDelTexto(List.of(texto));
    }

    @Test
    void loQueDiscrimina_noSePublica() {
        assertThat(revisar("Edad: 25")).contains("pide una edad");
        assertThat(revisar("Entre 20 y 30 años")).contains("pide una edad");
        assertThat(revisar("Solo mujeres")).contains("pide un sexo");
        assertThat(revisar("Sexo: masculino")).contains("pide un sexo");
        assertThat(revisar("Buscamos señoritas para recepción")).contains("pide un sexo");
        assertThat(revisar("Estado civil soltero")).contains("estado civil");
        assertThat(revisar("Sin hijos")).contains("estado civil");
        assertThat(revisar("Enviar hoja de vida con foto")).contains("pide una foto");
        assertThat(revisar("Buena presencia")).contains("aspecto físico");
    }

    @Test
    void loLegitimo_siSePublica() {
        assertThat(revisar("Mayor de edad")).isNull();
        assertThat(revisar("Mayor de 18 años")).isNull();
        assertThat(revisar("3 años de experiencia en cocina")).isNull();
        assertThat(revisar("Entre 2 y 5 años de experiencia")).isNull();
        assertThat(revisar("Experiencia en fotografía de producto")).isNull();
        assertThat(revisar("Atención a clientes de todas las edades")).isNull();
    }

    @Test
    void datosDeContacto_noSePublican() {
        assertThat(revisar("Escribe a rrhh@hotel.com")).contains("Quita los datos de contacto");
        assertThat(revisar("Llama al 300 123 4567")).contains("Quita los datos de contacto");
        assertThat(revisar("Fijo 605 123 4567")).contains("Quita los datos de contacto");
        assertThat(revisar("Por WhatsApp")).contains("Quita los datos de contacto");
    }

    @Test
    void fechaDeCierre_entreHoyY6Meses() {
        assertThat(RevisionVacante.problemaDeCierre(null)).contains("Pon la fecha");
        assertThat(RevisionVacante.problemaDeCierre(LocalDateTime.now().minusMinutes(1))).contains("ya pasó");
        assertThat(RevisionVacante.problemaDeCierre(LocalDateTime.now().plusMonths(6).plusDays(1))).contains("6 meses");
        assertThat(RevisionVacante.problemaDeCierre(LocalDateTime.now().plusMonths(6))).isNull();
        assertThat(RevisionVacante.problemaDeCierre(LocalDateTime.now().plusDays(30))).isNull();
    }
}
