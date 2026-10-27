package com.skillmatch.backend.validation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TelefonosTest {

    @Test
    void lasFormasDeEscribirUnCelularColombiano_quedanIguales() {
        assertThat(Telefonos.normalizar("3001234567")).contains("+573001234567");
        assertThat(Telefonos.normalizar("300 123 4567")).contains("+573001234567");
        assertThat(Telefonos.normalizar("300-123-4567")).contains("+573001234567");
        assertThat(Telefonos.normalizar("+57 300 123 4567")).contains("+573001234567");
        assertThat(Telefonos.normalizar("(+57) 3001234567")).contains("+573001234567");
    }

    @Test
    void fijoDeCartagenaYNumerosDeOtrosPaises() {
        assertThat(Telefonos.normalizar("605 6601234")).contains("+576056601234");
        assertThat(Telefonos.normalizar("+34 612 345 678")).contains("+34612345678");
    }

    @Test
    void loQueNoEsUnNumeroReal_seRechaza() {
        assertThat(Telefonos.normalizar("abc")).isEmpty();
        assertThat(Telefonos.normalizar("12345")).isEmpty();
        assertThat(Telefonos.normalizar("99999999999999999999")).isEmpty();
        assertThatThrownBy(() -> Telefonos.normalizarOpcional("12345"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(Telefonos.MENSAJE);
    }

    @Test
    void vacio_esOpcional() {
        assertThat(Telefonos.normalizarOpcional(null)).isNull();
        assertThat(Telefonos.normalizarOpcional("  ")).isNull();
    }
}
