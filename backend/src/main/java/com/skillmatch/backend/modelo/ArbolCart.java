package com.skillmatch.backend.modelo;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

/**
 * Arbol de decision CART para dos clases (0 rechazada, 1 aceptada), escrito desde cero.
 *
 * Hace lo mismo que DecisionTreeClassifier de scikit-learn con criterion="gini",
 * max_depth y min_samples_leaf, para que el script de Python del profesor pueda
 * comprobar que da lo mismo:
 *  - En cada nodo prueba TODOS los datos y todos los cortes posibles (el punto medio entre
 *    dos valores seguidos distintos) y se queda con el que mas baja la mezcla (Gini).
 *  - Un corte solo vale si deja al menos minHoja casos a cada lado.
 *  - Para de dividir si llega a la profundidad maxima, si el nodo es puro o si no hay corte valido.
 *  - Pregunta "x <= umbral": si es cierto va a la izquierda ("no" en los textos), si no, a la derecha.
 *
 * Sin librerias: solo Java.
 */
public class ArbolCart {

    /** Un nodo del arbol. En las hojas, variable = -1. */
    public static final class Nodo {
        public int id;
        public int variable = -1;
        public double umbral;
        public int izquierda = -1;   // x <= umbral
        public int derecha = -1;     // x >  umbral
        public int n;
        public int aceptadas;
        public int profundidad;
        public double gini;

        public boolean esHoja() { return variable < 0; }
        public double prob() { return n == 0 ? 0 : (double) aceptadas / n; }
    }

    private static final double CASI_IGUALES = 1e-7;   // FEATURE_THRESHOLD de scikit-learn

    private final int profundidadMaxima;
    private final int minHoja;
    private final List<Nodo> nodos = new ArrayList<>();
    private int numVariables;

    public ArbolCart(int profundidadMaxima, int minHoja) {
        this.profundidadMaxima = profundidadMaxima;
        this.minHoja = minHoja;
    }

    public List<Nodo> nodos() { return nodos; }

    public ArbolCart entrenar(double[][] x, int[] y) {
        nodos.clear();
        numVariables = x.length == 0 ? 0 : x[0].length;
        // scikit-learn trabaja los datos en float32: se redondean igual para que los cortes coincidan
        double[][] xf = new double[x.length][];
        for (int i = 0; i < x.length; i++) {
            xf[i] = new double[numVariables];
            for (int j = 0; j < numVariables; j++) xf[i][j] = (float) x[i][j];
        }
        x = xf;
        int[] todos = new int[x.length];
        for (int i = 0; i < todos.length; i++) todos[i] = i;
        construir(x, y, todos, 0);
        return this;
    }

    private static double gini(int n, int unos) {
        if (n == 0) return 0;
        double p = (double) unos / n;
        return 1 - p * p - (1 - p) * (1 - p);
    }

    /** Crea el nodo (preorden, como scikit-learn: primero el nodo, luego su izquierda y luego su derecha). */
    private int construir(double[][] x, int[] y, int[] filas, int profundidad) {
        Nodo nodo = new Nodo();
        nodo.id = nodos.size();
        nodo.n = filas.length;
        for (int f : filas) nodo.aceptadas += y[f];
        nodo.gini = gini(nodo.n, nodo.aceptadas);
        nodo.profundidad = profundidad;
        nodos.add(nodo);

        boolean hoja = profundidad >= profundidadMaxima
                || filas.length < 2
                || filas.length < 2 * minHoja
                || nodo.gini <= 1e-7;
        if (hoja) return nodo.id;

        // Mejor corte: el que mas baja la mezcla ponderada (n_izq*gini_izq + n_der*gini_der)
        double mejorCosto = Double.POSITIVE_INFINITY;
        int mejorVar = -1;
        double mejorUmbral = 0;
        Integer[] orden = new Integer[filas.length];
        for (int v = 0; v < numVariables; v++) {
            for (int i = 0; i < filas.length; i++) orden[i] = filas[i];
            final int var = v;
            Arrays.sort(orden, Comparator.comparingDouble(f -> x[f][var]));
            if (x[orden[orden.length - 1]][v] <= x[orden[0]][v] + CASI_IGUALES) continue; // dato constante aqui

            int izqN = 0, izqUnos = 0;
            for (int i = 0; i < orden.length - 1; i++) {
                izqN++;
                izqUnos += y[orden[i]];
                double actual = x[orden[i]][v], siguiente = x[orden[i + 1]][v];
                if (siguiente <= actual + CASI_IGUALES) continue;           // no se puede cortar entre iguales
                int derN = filas.length - izqN, derUnos = nodo.aceptadas - izqUnos;
                if (izqN < minHoja || derN < minHoja) continue;
                double costo = izqN * gini(izqN, izqUnos) + derN * gini(derN, derUnos);
                if (costo < mejorCosto - 1e-12) {
                    mejorCosto = costo;
                    mejorVar = v;
                    mejorUmbral = actual / 2.0 + siguiente / 2.0;
                    if (mejorUmbral == siguiente) mejorUmbral = actual;  // igual que scikit-learn con decimales raros
                }
            }
        }
        if (mejorVar < 0) return nodo.id;

        List<Integer> izq = new ArrayList<>(), der = new ArrayList<>();
        for (int f : filas) (x[f][mejorVar] <= mejorUmbral ? izq : der).add(f);
        nodo.variable = mejorVar;
        nodo.umbral = mejorUmbral;
        nodo.izquierda = construir(x, y, izq.stream().mapToInt(Integer::intValue).toArray(), profundidad + 1);
        nodo.derecha = construir(x, y, der.stream().mapToInt(Integer::intValue).toArray(), profundidad + 1);
        return nodo.id;
    }

    /** La hoja a la que llega una fila. */
    public Nodo hoja(double[] fila) {
        Nodo n = nodos.get(0);
        while (!n.esHoja()) n = nodos.get((double) (float) fila[n.variable] <= n.umbral ? n.izquierda : n.derecha);
        return n;
    }

    public double probAceptada(double[] fila) { return hoja(fila).prob(); }

    /** Importancia de cada dato: cuanto bajo la mezcla en las preguntas que lo usan (suma 1). */
    public double[] importancia() {
        double[] imp = new double[numVariables];
        for (Nodo n : nodos) {
            if (n.esHoja()) continue;
            Nodo i = nodos.get(n.izquierda), d = nodos.get(n.derecha);
            imp[n.variable] += n.n * n.gini - i.n * i.gini - d.n * d.gini;
        }
        double total = Arrays.stream(imp).sum();
        if (total > 0) for (int k = 0; k < imp.length; k++) imp[k] /= total;
        return imp;
    }
}
