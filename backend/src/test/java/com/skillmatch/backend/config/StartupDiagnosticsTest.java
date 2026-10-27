package com.skillmatch.backend.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class StartupDiagnosticsTest {

    @Test
    void pista_daLaMismaHuellaQuePowerShellSinMostrarLaClave() {
        // "e167632e" = primeros 8 del SHA-256 de "Abc123xyz", calculado en PowerShell
        String pista = StartupDiagnostics.pistaDeLaClave("mongodb+srv://u:Abc123xyz@h/db");

        assertThat(pista).isEqualTo("largo=9, espacios o invisibles=no, espacios al inicio/fin de la URI=no, huella=e167632e")
                .doesNotContain("Abc123xyz");
    }

    @Test
    void pista_avisaDeEspacios() {
        assertThat(StartupDiagnostics.pistaDeLaClave("mongodb+srv://u:Abc123xyz @h/db "))
                .contains("largo=10", "espacios o invisibles=SI", "inicio/fin de la URI=SI")
                .doesNotContain("e167632e");
    }

    @Test
    void pista_decodificaLosPorcentajesComoElDriver() {
        // "%40" es "@": la clave real es "a@b"
        assertThat(StartupDiagnostics.pistaDeLaClave("mongodb+srv://u:a%40b@h/db")).contains("largo=3");
    }
}
