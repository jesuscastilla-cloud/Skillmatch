package com.skillmatch.backend.service;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * Texto de búsqueda del usuario convertido en patrón LITERAL para MongoDB.
 *
 * Antes se usaba tal cual como expresión regular: "C++" o "(" daban error, y un
 * patrón como "(a+)+$" ponía a MongoDB a probar millones de combinaciones (ReDoS).
 */
final class BusquedaSegura {

    static final int MAX_LARGO = 100;

    /** Campos por los que se pueden ordenar las vacantes. */
    static final Set<String> ORDEN_VACANTES = Set.of("postedDate", "salaryMin", "salaryMax", "title", "createdAt");

    private BusquedaSegura() {
    }

    /**
     * Recorta el texto y lo vuelve literal. Quita antes las barras con que el
     * frontend anterior escapaba los caracteres especiales ("C\+\+" -> "C++"),
     * para que una copia vieja del frontend en caché siga funcionando.
     */
    static String literal(String texto) {
        String limpio = texto == null ? "" : texto.trim();
        if (limpio.length() > MAX_LARGO) limpio = limpio.substring(0, MAX_LARGO);
        limpio = limpio.replaceAll("\\\\(.)", "$1");
        return Pattern.quote(limpio);
    }

    static String campoDeOrden(String sortBy) {
        // Set.of(...).contains(null) lanza NullPointerException: se revisa antes
        return sortBy != null && ORDEN_VACANTES.contains(sortBy) ? sortBy : "postedDate";
    }
}
