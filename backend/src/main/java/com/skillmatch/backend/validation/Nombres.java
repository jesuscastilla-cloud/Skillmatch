package com.skillmatch.backend.validation;

import java.text.Normalizer;
import java.util.regex.Pattern;

/**
 * Reglas para los nombres que escriben las personas y las empresas.
 *
 * Antes solo se exigía que no estuvieran vacíos y tuvieran 100 caracteres o
 * menos: un nombre podía ser "<<<###>>>", un emoji o puros espacios.
 *
 *  - Personas (nombre y apellidos): letras (con tildes, ñ, ü), espacios, guion
 *    y apóstrofo, entre 2 y 50 caracteres. "María-José", "D'Angelo".
 *  - Empresas: además números y & . , ( ), hasta 100. "A&B S.A.S.", "Hotel 5 Estrellas".
 *
 * Los espacios de más se quitan solos y los caracteres invisibles (de control o
 * de ancho cero, que copiar y pegar a veces trae) se borran antes de revisar.
 */
public final class Nombres {

    public static final int MIN = 2;
    public static final int MAX_PERSONA = 50;
    public static final int MAX_EMPRESA = 100;

    /** Palabras de letras separadas por un espacio, un guion o un apóstrofo. */
    private static final Pattern PERSONA = Pattern.compile("[\\p{L}\\p{M}]+(?:[ '’-][\\p{L}\\p{M}]+)*");

    /** Empieza por letra o número; luego letras, números, espacios y & . , ' ’ ( ) -; sin dos espacios seguidos. */
    private static final Pattern EMPRESA = Pattern.compile("[\\p{L}\\p{M}\\d(](?:[\\p{L}\\p{M}\\d.,&'’()-]| (?! ))*");

    /** Caracteres invisibles: de control, de formato (ancho cero, marcas de dirección) y similares. */
    private static final Pattern INVISIBLES = Pattern.compile("[\\p{Cc}\\p{Cf}\\p{Co}\\p{Cn}]");

    public static final String MENSAJE_PERSONA =
            "solo puede tener letras, espacios, guion (-) y apóstrofo ('), entre 2 y 50 caracteres";
    public static final String MENSAJE_EMPRESA =
            "El nombre de la empresa solo puede tener letras, números, espacios y & . , ( ) -, entre 2 y 100 caracteres.";

    private Nombres() {
    }

    /** Quita invisibles, une los espacios repetidos y recorta los extremos. null sigue null. */
    public static String limpiar(String texto) {
        if (texto == null) return null;
        String limpio = Normalizer.normalize(texto, Normalizer.Form.NFC);
        limpio = INVISIBLES.matcher(limpio).replaceAll("");
        return limpio.replaceAll("\\s+", " ").trim();
    }

    public static boolean esNombreDePersona(String nombre) {
        return nombre != null && largoValido(nombre, MAX_PERSONA) && PERSONA.matcher(nombre).matches();
    }

    public static boolean esNombreDeEmpresa(String nombre) {
        if (nombre == null || !largoValido(nombre, MAX_EMPRESA) || !EMPRESA.matcher(nombre).matches()) return false;
        // Al menos dos letras o números: "&.," no es un nombre
        return nombre.codePoints().filter(Character::isLetterOrDigit).count() >= MIN;
    }

    /** Nombre y apellidos de una persona ya limpios; error con el campo que falla. */
    public static void validarPersona(String nombre, String apellidos) {
        if (!esNombreDePersona(nombre)) throw new IllegalArgumentException("El nombre " + MENSAJE_PERSONA + ".");
        if (!esNombreDePersona(apellidos)) throw new IllegalArgumentException("El apellido " + MENSAJE_PERSONA + ".");
    }

    public static void validarEmpresa(String nombre) {
        if (!esNombreDeEmpresa(nombre)) throw new IllegalArgumentException(MENSAJE_EMPRESA);
    }

    /**
     * Para nombres que no escribió la persona en SkillMatch (los de Google): en vez de
     * rechazarlos, se quitan los caracteres que no van y se recortan a 50.
     * Si no queda nada usable, devuelve el valor por defecto.
     */
    public static String ajustarPersona(String texto, String porDefecto) {
        String limpio = limpiar(texto);
        if (limpio == null) return porDefecto;
        limpio = limpio.replaceAll("[^\\p{L}\\p{M} '’-]", " ")
                .replaceAll("\\s+", " ")
                .replaceAll("(^[ '’-]+)|([ '’-]+$)", "")
                .replaceAll("([ '’-])[ '’-]+", "$1");
        if (limpio.codePointCount(0, limpio.length()) > MAX_PERSONA) {
            limpio = limpio.substring(0, limpio.offsetByCodePoints(0, MAX_PERSONA)).replaceAll("[ '’-]+$", "");
        }
        return esNombreDePersona(limpio) ? limpio : porDefecto;
    }

    private static boolean largoValido(String texto, int maximo) {
        int largo = texto.codePointCount(0, texto.length());
        return largo >= MIN && largo <= maximo;
    }
}
