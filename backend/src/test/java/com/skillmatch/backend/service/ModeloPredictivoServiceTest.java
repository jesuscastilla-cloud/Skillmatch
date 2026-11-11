package com.skillmatch.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.skillmatch.backend.model.ModeloVersion;
import com.skillmatch.backend.repository.ModeloVersionRepository;

class ModeloPredictivoServiceTest {

    private final TablaEjemplosService tabla = mock(TablaEjemplosService.class);
    private final ModeloVersionRepository versiones = mock(ModeloVersionRepository.class);
    private final ModeloPredictivoService servicio = new ModeloPredictivoService(tabla, versiones);

    private ModeloVersion version(LocalDateTime fecha) {
        ModeloVersion v = new ModeloVersion();
        v.setFecha(fecha);
        v.setEstado("esperando");
        v.setModelo(Map.of("estado", "esperando"));
        return v;
    }

    @Test
    void conUnaVersionDeHoy_noVuelveAAprender() {
        when(versiones.findTopByOrderByFechaDesc()).thenReturn(Optional.of(version(LocalDateTime.now(ZoneId.of("America/Bogota")))));
        when(versiones.notas()).thenReturn(List.of());

        assertThat(servicio.actual()).containsEntry("estado", "esperando");
        verify(versiones, never()).save(any());
    }

    @Test
    void siElServidorDurmioLaNoche_aprendeAlDespertar() {
        List<ModeloVersion> guardadas = new ArrayList<>();
        ModeloVersion vieja = version(LocalDateTime.now(ZoneId.of("America/Bogota")).minusDays(2));
        when(versiones.findTopByOrderByFechaDesc()).thenAnswer(i ->
                Optional.of(guardadas.isEmpty() ? vieja : guardadas.get(guardadas.size() - 1)));
        when(versiones.save(any())).thenAnswer(i -> { guardadas.add(i.getArgument(0)); return i.getArgument(0); });
        when(versiones.notas()).thenReturn(List.of());
        when(tabla.filas()).thenReturn(List.of());
        when(tabla.habilidadesDeVacantes()).thenReturn(List.of());

        Map<String, Object> m = servicio.actual();

        assertThat(guardadas).hasSize(1);
        assertThat(m).containsEntry("estado", "esperando").containsKey("historial");
    }
}
