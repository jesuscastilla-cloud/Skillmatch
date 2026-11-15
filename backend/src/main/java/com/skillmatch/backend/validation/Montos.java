package com.skillmatch.backend.validation;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/**
 * Los limites de los salarios, en un solo lugar. Los usan la vacante (JobRequest), los filtros de
 * busqueda (JobController) y el texto de las vacantes guardadas. La pagina usa los mismos numeros
 * (perfil-empresa.js, SALARIO_MINIMO y SALARIO_MAXIMO).
 *
 * Son pesos colombianos por mes, enteros. "Sin salario" es dejarlo vacio: el cero no vale, porque
 * una vacante de "$0" parece un error o un engano y rompe el orden por salario.
 */
public final class Montos {

    public static final long SALARIO_MINIMO = 1;
    public static final long SALARIO_MAXIMO = 50_000_000L;

    public static final String MENSAJE_SALARIO =
            "El salario debe ser un número entero de pesos entre $1 y $50.000.000 al mes. Si no quieres mostrarlo, déjalo vacío.";

    private Montos() { }

    /** Vacio (null) vale; si hay numero tiene que ser entero y estar entre el minimo y el maximo. */
    public static boolean esSalarioValido(Double valor) {
        if (valor == null) return true;
        if (valor.isNaN() || valor.isInfinite()) return false;
        return valor == Math.rint(valor) && valor >= SALARIO_MINIMO && valor <= SALARIO_MAXIMO;
    }

    /** Para los filtros: lo mismo, pero con un mensaje que dice cual filtro es. */
    public static void exigirSalarioDeFiltro(String nombre, Double valor) {
        if (valor == null) return;
        if (valor.isNaN() || valor.isInfinite() || valor < 0 || valor > SALARIO_MAXIMO) {
            throw new IllegalArgumentException("El filtro " + nombre + " debe estar entre 0 y $50.000.000.");
        }
    }

    /** 1800000 -> "$1.800.000" (nunca "1.8E6"). */
    public static String pesos(double valor) {
        DecimalFormat formato = new DecimalFormat("#,##0", DecimalFormatSymbols.getInstance(new Locale("es", "CO")));
        return "$" + formato.format(Math.round(valor));
    }
}
