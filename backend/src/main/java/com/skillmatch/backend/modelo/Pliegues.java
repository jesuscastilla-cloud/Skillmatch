package com.skillmatch.backend.modelo;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Los grupos del examen (validacion cruzada): cada grupo es una vez "el examen" y los demas
 * son "el estudio".
 */
public final class Pliegues {

    private Pliegues() { }

    /** Al azar, con la misma proporcion de aceptadas en cada grupo. Devuelve el grupo de cada fila. */
    public static int[] estratificados(int[] y, int k, long semilla) {
        Random azar = new Random(semilla);
        int[] grupo = new int[y.length];
        for (int clase = 0; clase <= 1; clase++) {
            List<Integer> filas = new ArrayList<>();
            for (int i = 0; i < y.length; i++) if (y[i] == clase) filas.add(i);
            Collections.shuffle(filas, azar);
            for (int j = 0; j < filas.size(); j++) grupo[filas.get(j)] = j % k;
        }
        return grupo;
    }

    /**
     * Por vacante: todas las postulaciones de una misma vacante van al MISMO grupo (si una vacante
     * quedara en el estudio y en el examen, el modelo se examinaria con algo que ya vio), y cada
     * grupo conserva lo mas posible la proporcion de aceptadas y rechazadas.
     *
     * Es la idea de StratifiedGroupKFold de scikit-learn, sin azar, y la MISMA regla que
     * pliegues_por_vacante en entrenar_modelo.py: las vacantes con mas postulaciones van primero
     * y cada una entra al grupo donde las proporciones quedan mas parejas (a igual costo, el
     * grupo mas pequeno, y despues el de numero menor). Asi Python y Java reparten igual.
     */
    public static int[] porVacante(int[] y, int[] vacante, int k) {
        int[] total = new int[2];
        for (int v : y) total[v]++;
        Map<Integer, List<Integer>> grupos = new LinkedHashMap<>();
        for (int i = 0; i < y.length; i++) grupos.computeIfAbsent(vacante[i], v -> new ArrayList<>()).add(i);
        List<Integer> orden = new ArrayList<>(grupos.keySet());
        orden.sort(Comparator.<Integer>comparingInt(v -> -grupos.get(v).size()).thenComparingInt(v -> v));

        int[][] cuenta = new int[k][2];
        int[] tamano = new int[k];
        int[] pliegue = new int[y.length];
        for (int v : orden) {
            List<Integer> filas = grupos.get(v);
            int[] suma = new int[2];
            for (int i : filas) suma[y[i]]++;
            long mejorCosto = Long.MAX_VALUE;
            int mejor = 0;
            for (int g = 0; g < k; g++) {
                double costo = 0;
                for (int c = 0; c <= 1; c++) {
                    if (total[c] == 0) continue;
                    double[] partes = new double[k];
                    double media = 0;
                    for (int h = 0; h < k; h++) {
                        partes[h] = (double) (cuenta[h][c] + (h == g ? suma[c] : 0)) / total[c];
                        media += partes[h];
                    }
                    media /= k;
                    double sumaCuadrados = 0;
                    for (double p : partes) sumaCuadrados += (p - media) * (p - media);
                    costo += Math.sqrt(sumaCuadrados / k);
                }
                // Mismo desempate que Python: costo (redondeado), tamano del grupo, numero del grupo
                long redondeado = Math.round(costo * 1e9);
                if (redondeado < mejorCosto || (redondeado == mejorCosto && tamano[g] < tamano[mejor])) {
                    mejorCosto = redondeado;
                    mejor = g;
                }
            }
            for (int i : filas) pliegue[i] = mejor;
            cuenta[mejor][0] += suma[0];
            cuenta[mejor][1] += suma[1];
            tamano[mejor] += filas.size();
        }
        return pliegue;
    }
}
