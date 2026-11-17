package com.skillmatch.backend.service;

import java.util.function.Supplier;

/** Un cerrojo que solo ejecuta el trabajo: para las pruebas con mocks, donde no hay concurrencia ni base de datos. */
class SinCerrojo extends CerrojoService {
    SinCerrojo() { super(null); }

    @Override
    public <T> T con(String clave, Supplier<T> trabajo) { return trabajo.get(); }
}
