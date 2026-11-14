package com.skillmatch.backend.modelo;

/**
 * Regresion logistica con penalizacion L2 (C = 1), sobre los datos estandarizados.
 *
 * Es el mismo modelo que make_pipeline(StandardScaler(), LogisticRegression()) de
 * scikit-learn: minimiza  0,5 * |w|^2 + C * suma(log-perdida), sin penalizar el intercepto.
 * Como el problema es convexo, cualquier metodo llega al mismo resultado; aqui se usa
 * Newton-Raphson (pocas vueltas, cada una resuelve un sistema pequeno).
 *
 * Sirve para comparar con el arbol: si saca mejor F1, se usa en su lugar (PDF).
 */
public class RegresionLogistica {

    private static final double C = 1.0;
    private double[] media, escala, coef;
    private double intercepto;

    public double[] media() { return media; }
    public double[] escala() { return escala; }
    public double[] coef() { return coef; }
    public double intercepto() { return intercepto; }

    public RegresionLogistica entrenar(double[][] x, int[] y) {
        int n = x.length, p = x[0].length;
        // 1) Estandarizar: (x - media) / desviacion (si la desviacion es 0, se divide por 1)
        media = new double[p];
        escala = new double[p];
        for (double[] f : x) for (int j = 0; j < p; j++) media[j] += f[j] / n;
        for (double[] f : x) for (int j = 0; j < p; j++) escala[j] += (f[j] - media[j]) * (f[j] - media[j]) / n;
        for (int j = 0; j < p; j++) escala[j] = escala[j] < 1e-12 ? 1 : Math.sqrt(escala[j]);
        double[][] z = new double[n][p + 1];               // ultima columna = 1 (intercepto)
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < p; j++) z[i][j] = (x[i][j] - media[j]) / escala[j];
            z[i][p] = 1;
        }
        // 2) Newton-Raphson
        double[] w = new double[p + 1];
        for (int vuelta = 0; vuelta < 100; vuelta++) {
            double[] grad = new double[p + 1];
            double[][] hes = new double[p + 1][p + 1];
            for (int i = 0; i < n; i++) {
                double s = sigmoide(punto(z[i], w));
                for (int a = 0; a <= p; a++) {
                    grad[a] += C * (s - y[i]) * z[i][a];
                    for (int b = 0; b <= p; b++) hes[a][b] += C * s * (1 - s) * z[i][a] * z[i][b];
                }
            }
            for (int a = 0; a < p; a++) { grad[a] += w[a]; hes[a][a] += 1; }   // L2, sin el intercepto
            double[] paso = resolver(hes, grad);
            double cambio = 0;
            for (int a = 0; a <= p; a++) { w[a] -= paso[a]; cambio = Math.max(cambio, Math.abs(paso[a])); }
            if (cambio < 1e-10) break;
        }
        coef = java.util.Arrays.copyOf(w, p);
        intercepto = w[p];
        return this;
    }

    public double probAceptada(double[] fila) {
        double s = intercepto;
        for (int j = 0; j < coef.length; j++) s += coef[j] * (fila[j] - media[j]) / escala[j];
        return sigmoide(s);
    }

    private static double sigmoide(double t) { return 1 / (1 + Math.exp(-t)); }

    private static double punto(double[] a, double[] b) {
        double s = 0;
        for (int i = 0; i < a.length; i++) s += a[i] * b[i];
        return s;
    }

    /** Resuelve A x = b por eliminacion de Gauss con pivoteo (A es pequena: 15 x 15). */
    private static double[] resolver(double[][] a0, double[] b0) {
        int n = b0.length;
        double[][] a = new double[n][];
        for (int i = 0; i < n; i++) a[i] = a0[i].clone();
        double[] b = b0.clone();
        for (int c = 0; c < n; c++) {
            int piv = c;
            for (int r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
            double[] t = a[c]; a[c] = a[piv]; a[piv] = t;
            double tb = b[c]; b[c] = b[piv]; b[piv] = tb;
            if (Math.abs(a[c][c]) < 1e-15) continue;
            for (int r = c + 1; r < n; r++) {
                double f = a[r][c] / a[c][c];
                for (int k = c; k < n; k++) a[r][k] -= f * a[c][k];
                b[r] -= f * b[c];
            }
        }
        double[] x = new double[n];
        for (int r = n - 1; r >= 0; r--) {
            double s = b[r];
            for (int k = r + 1; k < n; k++) s -= a[r][k] * x[k];
            x[r] = Math.abs(a[r][r]) < 1e-15 ? 0 : s / a[r][r];
        }
        return x;
    }
}
