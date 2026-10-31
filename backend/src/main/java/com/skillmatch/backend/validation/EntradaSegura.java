package com.skillmatch.backend.validation;

import java.util.regex.Pattern;

/**
 * Reglas compartidas para lo que escriben las personas.
 *
 * Las imágenes y los enlaces se guardan como texto y el frontend los pone en
 * src="" o href="": un "javascript:..." ejecutaría código en el navegador de
 * quien lo abra, y la dirección de un servidor ajeno anotaría su IP.
 */
public final class EntradaSegura {

    /** Tope de habilidades, experiencias, estudios y certificaciones por persona. */
    public static final int MAX_POR_SECCION = 50;

    /** Una foto del editor (≤ 320 KB) ocupa ~440.000 caracteres en base64. */
    public static final int MAX_IMAGEN = 600_000;

    /**
     * Una ciudad o un lugar (vacío también vale): letras, números, espacios y , . ( ) / - '.
     * "Cartagena de Indias", "Turbaco, Bolívar", "Bocagrande (Cartagena)".
     */
    public static final String REGEX_LUGAR = "^$|^[\\p{L}\\p{M}\\d][\\p{L}\\p{M}\\d .,()/'’–-]{0,99}$";
    public static final String MENSAJE_LUGAR = "La ciudad solo puede tener letras, números, espacios y , . ( ) / -";

    /** Una habilidad: letras, números, espacios y + # . / & ( ) -, para "C#", "C++", "Node.js". */
    public static final String REGEX_HABILIDAD = "^[\\p{L}\\p{M}\\d.#+][\\p{L}\\p{M}\\d +#./&()'’-]{0,79}$";
    public static final String MENSAJE_HABILIDAD = "La habilidad solo puede tener letras, números, espacios y + # . / & ( ) -";

    /** Solo enlaces web, para usar en @Pattern (vacío también vale). */
    public static final String REGEX_ENLACE = "^$|^https?://\\S{1,490}$";

    private static final Pattern IMAGEN = Pattern.compile(
            "^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$"   // lo que guarda editor-imagen.js
            + "|^galeria:[a-z0-9-]{1,40}$"                          // portadas de la galería
            + "|^https://\\S{1,490}$");

    private EntradaSegura() {
    }

    public static boolean esImagenValida(String valor) {
        return valor != null && valor.length() <= MAX_IMAGEN && IMAGEN.matcher(valor).matches();
    }
}
