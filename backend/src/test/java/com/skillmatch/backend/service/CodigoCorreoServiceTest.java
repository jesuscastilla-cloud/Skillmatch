package com.skillmatch.backend.service;

import com.skillmatch.backend.model.CodigoCorreo;
import com.skillmatch.backend.repository.CodigoCorreoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class CodigoCorreoServiceTest {

    private static final Instant T0 = Instant.parse("2026-10-27T15:00:00Z");
    private static final String R = CodigoCorreoService.RECUPERAR_CLAVE;

    /** Repositorio en memoria: se comporta como la colección codigos_correo. */
    private final Map<String, CodigoCorreo> coleccion = new HashMap<>();
    private CodigoCorreoService service;

    @BeforeEach
    void setUp() {
        CodigoCorreoRepository repo = mock(CodigoCorreoRepository.class);
        when(repo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(coleccion.get(inv.<String>getArgument(0))));
        when(repo.save(any())).thenAnswer(inv -> {
            CodigoCorreo c = inv.getArgument(0);
            coleccion.put(c.getId(), c);
            return c;
        });
        doAnswer(inv -> coleccion.remove(inv.<String>getArgument(0))).when(repo).deleteById(anyString());
        service = new CodigoCorreoService(repo);
        enElMinuto(0);
    }

    @Test
    void elCodigoCorrecto_sirveUnaSolaVez() {
        String codigo = service.generar("ana@correo.co", R).orElseThrow();

        assertThat(codigo).matches("\\d{6}");
        assertThat(service.verificar("ANA@correo.co ", R, codigo)).isTrue();
        assertThat(service.verificar("ana@correo.co", R, codigo)).isFalse();
    }

    @Test
    void cincoFallos_matanElCodigo() {
        String codigo = service.generar("ana@correo.co", R).orElseThrow();
        String malo = codigo.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < 5; i++) assertThat(service.verificar("ana@correo.co", R, malo)).isFalse();

        assertThat(service.verificar("ana@correo.co", R, codigo)).isFalse();
    }

    @Test
    void codigoVencido_noSirve() {
        String codigo = service.generar("ana@correo.co", R).orElseThrow();
        enElMinuto(16);

        assertThat(service.verificar("ana@correo.co", R, codigo)).isFalse();
    }

    @Test
    void noSePideOtroEnElMismoMinuto() {
        service.generar("ana@correo.co", R);

        assertThat(service.generar("ana@correo.co", R)).isEmpty();
        enElMinuto(2);
        assertThat(service.generar("ana@correo.co", R)).isPresent();
    }

    @Test
    void elCodigoDeUnPropositoNoSirveParaOtro() {
        String codigo = service.generar("ana@correo.co", CodigoCorreoService.REGISTRO).orElseThrow();

        assertThat(service.verificar("ana@correo.co", R, codigo)).isFalse();
    }

    @Test
    void noSeGuardaElCodigo() {
        String codigo = service.generar("ana@correo.co", R).orElseThrow();

        assertThat(coleccion.values()).allSatisfy(c -> {
            assertThat(c.getCodigoHash()).doesNotContain(codigo).hasSize(64);
            assertThat(c.getId()).doesNotContain("ana");
        });
    }

    private void enElMinuto(int minuto) {
        service.setClock(Clock.fixed(T0.plus(Duration.ofMinutes(minuto)), ZoneOffset.UTC));
    }
}
