package com.skillmatch.backend.modelo;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Las notas del examen, calculadas sobre todas las postulaciones juntas (cada una salio
 * una vez en el examen). Las mismas formulas que scikit-learn.
 */
public final class Metricas {

    private Metricas() { }

    /** exactitud, precision, sensibilidad (recall), f1 y roc_auc de la clase "aceptada". */
    public static Map<String, Double> calcular(int[] real, int[] dijo, double[] prob) {
        int vp = 0, vn = 0, fp = 0, fn = 0;
        for (int i = 0; i < real.length; i++) {
            if (dijo[i] == 1 && real[i] == 1) vp++;
            else if (dijo[i] == 0 && real[i] == 0) vn++;
            else if (dijo[i] == 1) fp++;
            else fn++;
        }
        double exactitud = (double) (vp + vn) / real.length;
        double precision = vp + fp == 0 ? 0 : (double) vp / (vp + fp);
        double sensibilidad = vp + fn == 0 ? 0 : (double) vp / (vp + fn);
        double f1 = precision + sensibilidad == 0 ? 0 : 2 * precision * sensibilidad / (precision + sensibilidad);
        Map<String, Double> m = new LinkedHashMap<>();
        m.put("exactitud", redondear(exactitud));
        m.put("precision", redondear(precision));
        m.put("sensibilidad", redondear(sensibilidad));
        m.put("f1", redondear(f1));
        m.put("roc_auc", rocAuc(real, prob));
        return m;
    }

    /** [vp, vn, fp, fn] */
    public static int[] matriz(int[] real, int[] dijo) {
        int[] m = new int[4];
        for (int i = 0; i < real.length; i++) {
            if (dijo[i] == 1 && real[i] == 1) m[0]++;
            else if (dijo[i] == 0 && real[i] == 0) m[1]++;
            else if (dijo[i] == 1) m[2]++;
            else m[3]++;
        }
        return m;
    }

    /** ROC-AUC con rangos promedio (empates cuentan la mitad). 0,5 = tirar una moneda. */
    static Double rocAuc(int[] real, double[] prob) {
        int n = real.length, pos = 0;
        for (int r : real) pos += r;
        int neg = n - pos;
        if (pos == 0 || neg == 0) return null;
        Integer[] orden = new Integer[n];
        for (int i = 0; i < n; i++) orden[i] = i;
        Arrays.sort(orden, (a, b) -> Double.compare(prob[a], prob[b]));
        double[] rango = new double[n];
        for (int i = 0; i < n; ) {
            int j = i;
            while (j + 1 < n && prob[orden[j + 1]] == prob[orden[i]]) j++;
            double promedio = (i + j) / 2.0 + 1;
            for (int k = i; k <= j; k++) rango[orden[k]] = promedio;
            i = j + 1;
        }
        double suma = 0;
        for (int i = 0; i < n; i++) if (real[i] == 1) suma += rango[i];
        return redondear((suma - pos * (pos + 1) / 2.0) / ((double) pos * neg));
    }

    public static double redondear(double v) { return Math.round(v * 10000) / 10000.0; }
}
