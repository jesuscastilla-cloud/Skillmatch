package com.skillmatch.backend.validation;

import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Las paginas que llegan por ?page=&size=&sort= se limpian antes de usarse. Antes, ?sort=$where
 * o ?sort=password llegaba tal cual a MongoDB (error 500 o, peor, ordenar por un campo privado).
 * Ahora solo se ordena por los campos que la lista permite, el tamano nunca pasa de 50 y la
 * pagina nunca es negativa.
 */
public final class Paginas {

    public static final int TAMANO_MAXIMO = 50;

    private Paginas() { }

    public static Pageable segura(Pageable pedida, Set<String> camposPermitidos, Sort porDefecto) {
        int pagina = Math.max(0, pedida.getPageNumber());
        int tamano = Math.max(1, Math.min(TAMANO_MAXIMO, pedida.getPageSize()));
        Sort orden = pedida.getSort().stream().allMatch(o -> camposPermitidos.contains(o.getProperty()))
                && pedida.getSort().isSorted() ? pedida.getSort() : porDefecto;
        return PageRequest.of(pagina, tamano, orden);
    }
}
