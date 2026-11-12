package com.skillmatch.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;

/** "Cuántos se postularon antes": solo cuentan los que llegaron ANTES (nada del futuro). */
class TablaEjemplosServiceTest {

    private static final LocalDateTime LUNES = LocalDateTime.of(2026, 11, 2, 9, 0);

    @Test
    void soloCuentanLosQueLlegaronAntes() {
        List<LocalDateTime> fechas = List.of(LUNES, LUNES.plusDays(1), LUNES.plusDays(2), LUNES.plusDays(5));
        assertEquals(0, TablaEjemplosService.antes(fechas, LUNES), "la primera no tiene a nadie antes");
        assertEquals(2, TablaEjemplosService.antes(fechas, LUNES.plusDays(2)), "la tercera tiene 2 antes");
        // Los que llegan despues no cambian la cifra de una postulacion ya hecha
        assertEquals(1, TablaEjemplosService.antes(fechas, LUNES.plusDays(1)));
    }

    @Test
    void sinFechasNoCuentaNada() {
        assertEquals(0, TablaEjemplosService.antes(null, LUNES));
        assertEquals(0, TablaEjemplosService.antes(List.of(LUNES), null));
    }
}
