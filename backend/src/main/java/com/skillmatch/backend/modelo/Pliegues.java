package com.skillmatch.backend.modelo;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * Validacion cruzada estratificada: reparte las postulaciones en k grupos con la misma
 * proporcion de aceptadas y rechazadas en cada uno. Cada grupo es una vez "el examen".
 */
public final class Pliegues {

    private Pliegues() { }

    /** Devuelve, para cada fila, el numero de su grupo (0 a k-1). */
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
}
