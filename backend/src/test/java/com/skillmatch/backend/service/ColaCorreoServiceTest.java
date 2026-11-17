package com.skillmatch.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.LocalDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.skillmatch.backend.service.ColaCorreoService.Prioridad;
import com.skillmatch.backend.service.ColaCorreoService.Resultado;

/** El tope diario de correos: quien pasa primero, que queda en espera y que pasa cuando algo no sale. */
class ColaCorreoServiceTest {

    private final CorreoService correo = mock(CorreoService.class);
    private ColaEnMemoria cola;

    @BeforeEach
    void preparar() {
        when(correo.enviar(anyString(), anyString(), anyString())).thenReturn(true);
        when(correo.configurado()).thenReturn(true);
        cola = new ColaEnMemoria(correo, 10);       // tope de 10: ALTA 10, MEDIA 8, BAJA 7
    }

    private Resultado mandar(Prioridad p) {
        return cola.enviar("a@correo.co", "asunto " + p, "texto", p, Duration.ofDays(1));
    }

    @Test
    void losDeMenorImportanciaNoSeComenElCupoDeLasInvitaciones() {
        for (int i = 0; i < 7; i++) assertThat(mandar(Prioridad.BAJA)).isEqualTo(Resultado.ENVIADO);
        assertThat(mandar(Prioridad.BAJA)).as("el 8.º de baja importancia espera").isEqualTo(Resultado.EN_COLA);
        // Aunque lo de baja importancia ya no cabe, las invitaciones todavia tienen sus 3 cupos
        for (int i = 0; i < 3; i++) assertThat(mandar(Prioridad.ALTA)).isEqualTo(Resultado.ENVIADO);
        assertThat(mandar(Prioridad.ALTA)).as("agotado el tope del dia").isEqualTo(Resultado.EN_COLA);
        assertThat(cola.enviados).isEqualTo(10);
    }

    @Test
    void losRecordatoriosTienenMasMargenQueLosMensajes() {
        for (int i = 0; i < 8; i++) assertThat(mandar(Prioridad.MEDIA)).isEqualTo(Resultado.ENVIADO);
        assertThat(mandar(Prioridad.MEDIA)).isEqualTo(Resultado.EN_COLA);
    }

    @Test
    void alLlegarAlTopeNadaSePierde_QuedaEnLaColaYSaleAlDiaSiguiente() {
        for (int i = 0; i < 10; i++) mandar(Prioridad.ALTA);
        assertThat(mandar(Prioridad.ALTA)).isEqualTo(Resultado.EN_COLA);
        assertThat(mandar(Prioridad.BAJA)).isEqualTo(Resultado.EN_COLA);
        assertThat(cola.contarPendientes()).isEqualTo(2);
        verify(correo, times(10)).enviar(anyString(), anyString(), anyString());

        cola.nuevoDia();
        assertThat(cola.vaciarCola()).isEqualTo(2);
        assertThat(cola.contarPendientes()).isZero();
        verify(correo, times(12)).enviar(anyString(), anyString(), anyString());
    }

    @Test
    void laColaSaleDeLoMasImportanteAMenos() {
        for (int i = 0; i < 10; i++) mandar(Prioridad.ALTA);
        mandar(Prioridad.BAJA);       // llega primero pero importa menos
        mandar(Prioridad.ALTA);
        cola.nuevoDia();
        cola.enviados = 9;            // queda un solo cupo en el dia
        assertThat(cola.vaciarCola()).isEqualTo(1);
        assertThat(cola.cola).hasSize(1);
        assertThat(cola.cola.get(0).getPrioridad()).as("lo que espera es lo de baja importancia").isEqualTo("BAJA");
    }

    @Test
    void unCorreoQueYaNoSirveSeDescartaYSeCuenta() {
        for (int i = 0; i < 10; i++) mandar(Prioridad.ALTA);
        cola.enviar("a@correo.co", "viejo", "texto", Prioridad.ALTA, Duration.ofSeconds(-5));
        cola.nuevoDia();
        assertThat(cola.vaciarCola()).isZero();
        assertThat(cola.descartados).isEqualTo(1);
        assertThat(cola.estado()).containsEntry("descartadosHoy", 1).containsEntry("pendientes", 0L);
    }

    @Test
    void siElEnvioFallaSeReintentaYAlTercerFalloSeDescarta() {
        when(correo.enviar(anyString(), anyString(), anyString())).thenReturn(false);
        assertThat(mandar(Prioridad.ALTA)).isEqualTo(Resultado.EN_COLA);
        assertThat(cola.enviados).as("el cupo no se gasta si no salio").isZero();
        cola.vaciarCola();                         // intento 2
        assertThat(cola.cola).hasSize(1);
        cola.vaciarCola();                         // intento 3: se rinde
        assertThat(cola.cola).isEmpty();
        assertThat(cola.descartados).isEqualTo(1);
    }

    @Test
    void sinServicioDeCorreoNoSeAcumulaNada() {
        when(correo.enviar(anyString(), anyString(), anyString())).thenReturn(false);
        when(correo.configurado()).thenReturn(false);
        assertThat(mandar(Prioridad.ALTA)).isEqualTo(Resultado.NO_ENVIADO);
        assertThat(cola.contarPendientes()).isZero();
    }

    @Test
    void sinDireccionNoHayNadaQueEnviar() {
        assertThat(cola.enviar(" ", "x", "y", Prioridad.ALTA, Duration.ofDays(1))).isEqualTo(Resultado.NO_ENVIADO);
    }

    @Test
    void elEstadoDelDiaDiceCuantoSeEnvioYCuantoEspera() {
        for (int i = 0; i < 11; i++) mandar(Prioridad.ALTA);
        assertThat(cola.estado())
                .containsEntry("enviadosHoy", 10).containsEntry("topeDiario", 10)
                .containsEntry("pendientes", 1L).containsEntry("reservadoParaCodigos", 100);
        assertThat(cola.cola.get(0).getVence()).isAfter(LocalDateTime.now());
    }
}
