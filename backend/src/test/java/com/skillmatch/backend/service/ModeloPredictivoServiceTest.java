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

    /** Un arbol de una sola pregunta sobre las habilidades; probSi = aceptadas cuando tiene mas del 50 %. */
    private void modeloDeUnaPregunta(double probSi, double probNo) {
        Map<String, Object> raiz = new java.util.HashMap<>(Map.of("id", 0, "variable", "pct_habilidades", "umbral", 50.0,
                "si", 1, "no", 2, "prob", 0.5,
                "frase_si", "tienen más del 50 % de las habilidades pedidas",
                "frase_no", "tienen el 50 % o menos de las habilidades pedidas"));
        Map<String, Object> modelo = Map.of("estado", "listo", "dar_consejos", true, "arbol", List.of(raiz,
                Map.of("id", 1, "hoja", true, "prob", probSi), Map.of("id", 2, "hoja", true, "prob", probNo)));
        ModeloVersion v = version(LocalDateTime.now(ZoneId.of("America/Bogota")));
        v.setEstado("listo");
        v.setModelo(modelo);
        when(versiones.findTopByOrderByFechaDesc()).thenReturn(Optional.of(v));
        when(versiones.notas()).thenReturn(List.of());
    }

    private void postulacionCon(int pctHabilidades) {
        when(tabla.unaPostulacion(any(), any())).thenReturn(Map.of(
                "caracteristicas", Map.of("pct_habilidades", pctHabilidades), "faltan", List.of("Inglés básico")));
    }

    @Test
    void elConsejoSoloPideSubirAlgo() {
        // Quien tiene pocas habilidades, donde tener mas suele ir mejor: se le aconseja agregarlas
        modeloDeUnaPregunta(0.8, 0.2);
        postulacionCon(20);
        assertThat(servicio.consejoPara(new com.skillmatch.backend.model.Application()))
                .contains("más del 50 %").contains("Te falta: Inglés básico");
    }

    @Test
    void nuncaAconsejaTenerMenos() {
        // Si en los datos las de MENOS habilidades fueron mas aceptadas, no se aconseja "ten menos"
        modeloDeUnaPregunta(0.2, 0.8);
        postulacionCon(80);
        assertThat(servicio.consejoPara(new com.skillmatch.backend.model.Application())).isEmpty();
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

    @Test
    void siEsperabaDatosHaceMasDeMediaHora_vuelveAIntentar() {
        List<ModeloVersion> guardadas = new ArrayList<>();
        ModeloVersion vieja = version(LocalDateTime.now(ZoneId.of("America/Bogota")).minusMinutes(40));
        when(versiones.findTopByOrderByFechaDesc()).thenAnswer(i ->
                Optional.of(guardadas.isEmpty() ? vieja : guardadas.get(guardadas.size() - 1)));
        when(versiones.save(any())).thenAnswer(i -> { guardadas.add(i.getArgument(0)); return i.getArgument(0); });
        when(versiones.notas()).thenReturn(List.of());
        when(tabla.filas()).thenReturn(List.of());
        when(tabla.habilidadesDeVacantes()).thenReturn(List.of());

        servicio.actual();

        assertThat(guardadas).hasSize(1);
    }

    @Test
    void siEsperabaDatosHaceCincoMinutos_noVuelveAIntentar() {
        ModeloVersion reciente = version(LocalDateTime.now(ZoneId.of("America/Bogota")).minusMinutes(5));
        when(versiones.findTopByOrderByFechaDesc()).thenReturn(Optional.of(reciente));
        when(versiones.notas()).thenReturn(List.of());

        servicio.actual();

        verify(versiones, never()).save(any());
    }
}
