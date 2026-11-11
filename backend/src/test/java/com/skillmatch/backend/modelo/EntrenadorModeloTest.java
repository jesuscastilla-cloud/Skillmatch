package com.skillmatch.backend.modelo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * El modelo de Java da LO MISMO que el script de Python del profesor (scikit-learn).
 *
 * Los archivos de src/test/resources/modelo/ salen de correr, en la carpeta de la propuesta:
 *   python 1-datos/generar_datos_semilla.py
 *   python 2-modelo/entrenar_modelo.py --datos 1-datos/datos/ejemplos_semilla.csv
 * predicciones.csv trae en que grupo del examen quedo cada fila, para usar los mismos 5 grupos.
 */
class EntrenadorModeloTest {

    static List<Map<String, Number>> filas = new ArrayList<>();
    static List<List<String>> vacantes = new ArrayList<>();
    static int[] pliegues;
    static JsonNode python;
    static Map<String, Object> java;

    @BeforeAll
    static void cargar() throws IOException {
        List<String> tabla = lineas("ejemplos_semilla.csv");
        String[] cab = tabla.get(0).split(",");
        for (String l : tabla.subList(1, tabla.size())) {
            String[] v = l.split(",");
            Map<String, Number> f = new LinkedHashMap<>();
            for (int i = 0; i < cab.length; i++) f.put(cab[i], Double.parseDouble(v[i]));
            filas.add(f);
        }
        for (String l : lineas("vacantes_habilidades.csv").subList(1, lineas("vacantes_habilidades.csv").size())) {
            vacantes.add(Arrays.asList(l.split(";")));
        }
        List<String> pred = lineas("predicciones.csv");
        int col = Arrays.asList(pred.get(0).split(",")).indexOf("pliegue");
        pliegues = pred.subList(1, pred.size()).stream().mapToInt(l -> (int) Double.parseDouble(l.split(",")[col])).toArray();
        try (InputStream in = EntrenadorModeloTest.class.getResourceAsStream("/modelo/modelo-python.json")) {
            python = new ObjectMapper().readTree(in);
        }
        java = EntrenadorModelo.entrenar(filas, vacantes, "semilla", false, pliegues);
    }

    static List<String> lineas(String archivo) throws IOException {
        try (InputStream in = EntrenadorModeloTest.class.getResourceAsStream("/modelo/" + archivo)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).lines().filter(s -> !s.isBlank()).toList();
        }
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> mapa(Object o) { return (Map<String, Object>) o; }

    @Test
    void mismosDatos() {
        Map<String, Object> d = mapa(java.get("datos"));
        assertEquals(python.at("/datos/respondidas").asInt(), d.get("respondidas"));
        assertEquals(python.at("/datos/aceptadas").asInt(), d.get("aceptadas"));
        assertEquals("listo", java.get("estado"));
    }

    /**
     * Mismo arbol: cada nodo separa EXACTAMENTE las mismas postulaciones (mismo n y mismas aceptadas).
     * Cuando dos preguntas separan igual (por ejemplo "tiene alguna habilidad pedida" y "su nivel pasa
     * de 0", que son lo mismo), scikit-learn escoge una al azar y Java la primera; por eso se acepta
     * otra variable si el corte es equivalente: lo que se comprueba es que separe a las mismas personas.
     */
    @Test
    void mismoArbol() {
        List<Map<String, Object>> nodos = (List<Map<String, Object>>) java.get("arbol");
        JsonNode py = python.get("arbol");
        assertEquals(py.size(), nodos.size(), "mismo numero de nodos");
        int iguales = 0;
        for (int i = 0; i < nodos.size(); i++) {
            Map<String, Object> j = nodos.get(i);
            JsonNode p = py.get(i);
            assertEquals(p.get("n").asInt(), j.get("n"), "n del nodo " + i);
            assertEquals(p.get("aceptadas").asInt(), j.get("aceptadas"), "aceptadas del nodo " + i);
            assertEquals(p.has("hoja"), j.containsKey("hoja"), "hoja " + i);
            if (!p.has("hoja")) {
                assertEquals(p.get("si").asInt(), j.get("si"));
                assertEquals(p.get("no").asInt(), j.get("no"));
                if (p.get("variable").asText().equals(j.get("variable"))) {
                    assertEquals(p.get("umbral").asDouble(), (Double) j.get("umbral"), 1e-3, "umbral del nodo " + i);
                    assertEquals(p.get("pregunta").asText(), j.get("pregunta"), "pregunta del nodo " + i);
                    iguales++;
                }
            }
        }
        System.out.println("Preguntas con la misma variable que Python: " + iguales);
    }

    /**
     * Para cada postulacion, el arbol final de Java da la misma probabilidad que el de Python,
     * salvo las que caen en un empate exacto (dos preguntas que separan igual de bien). Se exige
     * que coincidan al menos 9 de cada 10 y se imprime cuantas.
     */
    @Test
    void mismaProbabilidadEnCadaPostulacion() throws IOException {
        List<String> pred = lineas("predicciones.csv");
        List<String> cab = Arrays.asList(pred.get(0).split(","));
        double[][] x = new double[filas.size()][EntrenadorModelo.COLUMNAS.size()];
        int[] y = new int[filas.size()];
        for (int i = 0; i < filas.size(); i++) {
            for (int k = 0; k < x[i].length; k++) x[i][k] = filas.get(i).get(EntrenadorModelo.COLUMNAS.get(k)).doubleValue();
            y[i] = filas.get(i).get("aceptada").intValue();
        }
        ArbolCart arbol = new ArbolCart(4, 5).entrenar(x, y);
        int col = cab.indexOf("prob_arbol"), iguales = 0;
        for (int i = 0; i < filas.size(); i++) {
            double esperado = Double.parseDouble(pred.get(i + 1).split(",")[col]);
            if (Math.abs(esperado - arbol.probAceptada(x[i])) < 1e-3) iguales++;
        }
        System.out.println("Postulaciones con la misma probabilidad en Java y Python: " + iguales + " de " + filas.size());
        assertTrue(iguales >= 0.9 * filas.size(), iguales + " de " + filas.size());
    }

    @Test
    void mismaNotaDelExamen() {
        Map<String, Object> modelos = mapa(mapa(java.get("examen")).get("modelos"));
        for (String m : List.of("arbol", "flojo")) {
            Map<String, Object> notas = mapa(modelos.get(m));
            for (String k : List.of("exactitud", "precision", "sensibilidad", "f1", "roc_auc")) {
                // 0,01: en un pliegue puede haber un empate que scikit-learn rompe al azar (ver mismoArbol)
                assertEquals(python.at("/examen/modelos/" + m + "/" + k).asDouble(), (Double) notas.get(k), 0.01, m + " " + k);
            }
        }
        // La logistica llega al mismo optimo por otro camino: se permite una diferencia minima
        Map<String, Object> log = mapa(modelos.get("logistica"));
        assertEquals(python.at("/examen/modelos/logistica/exactitud").asDouble(), (Double) log.get("exactitud"), 0.02);
        assertEquals(python.at("/examen/modelos/logistica/roc_auc").asDouble(), (Double) log.get("roc_auc"), 0.01);
        Map<String, Object> m = mapa(mapa(java.get("examen")).get("matriz"));
        for (String k : List.of("vp", "vn", "fp", "fn")) {
            assertEquals(python.at("/examen/matriz/" + k).asInt(), (Integer) m.get(k), 2, k);
        }
        assertEquals(python.at("/examen/le_gana_al_flojo").asBoolean(), mapa(java.get("examen")).get("le_gana_al_flojo"));
        assertFalse((Boolean) java.get("dar_consejos"), "con datos al azar no da consejos");
    }

    @Test
    void mismaImportanciaYLogistica() {
        List<Map<String, Object>> imp = (List<Map<String, Object>>) java.get("importancia");
        JsonNode py = python.get("importancia");
        assertEquals(py.size(), imp.size());
        // Las mismas cifras en el mismo orden (el nombre puede cambiar entre dos datos equivalentes)
        for (int i = 0; i < imp.size(); i++) {
            assertEquals(py.get(i).get("valor").asDouble(), (Double) imp.get(i).get("valor"), 1e-3);
        }
        List<Double> coef = (List<Double>) mapa(java.get("logistica")).get("coef");
        for (int i = 0; i < coef.size(); i++) {
            assertEquals(python.at("/logistica/coef/" + i).asDouble(), coef.get(i), 1e-3, "coeficiente " + i);
        }
    }

    @Test
    void mismasHabilidadesJuntas() {
        List<Map<String, Object>> r = (List<Map<String, Object>>) java.get("habilidades_juntas");
        JsonNode py = python.get("habilidades_juntas");
        assertEquals(py.size(), r.size());
        for (int i = 0; i < r.size(); i++) {
            assertEquals(py.get(i).get("si").asText(), r.get(i).get("si"));
            assertEquals(py.get(i).get("entonces").asText(), r.get(i).get("entonces"));
            assertEquals(py.get(i).get("lift").asDouble(), (Double) r.get(i).get("lift"), 1e-4);
        }
    }

    @Test
    void conPocosDatosEspera() {
        Map<String, Object> r = EntrenadorModelo.entrenar(filas.subList(0, 20), vacantes, "plataforma", false);
        assertEquals("esperando", r.get("estado"));
        assertEquals(10, mapa(r.get("datos")).get("faltan"));
        assertFalse((Boolean) r.get("dar_consejos"));
    }

    @Test
    void encuentraUnPatronCuandoLoHay() {
        // Control positivo: si la respuesta depende de tener habilidades, el arbol lo encuentra y le gana al flojo
        List<Map<String, Number>> conPatron = new ArrayList<>();
        java.util.Random azar = new java.util.Random(7);
        for (Map<String, Number> f : filas) {
            Map<String, Number> g = new LinkedHashMap<>(f);
            double p = f.get("pct_habilidades").doubleValue() > 0 ? 0.85 : 0.15;
            g.put("aceptada", azar.nextDouble() < p ? 1 : 0);
            conPatron.add(g);
        }
        Map<String, Object> r = EntrenadorModelo.entrenar(conPatron, vacantes, "semilla", false);
        assertTrue((Boolean) mapa(r.get("examen")).get("le_gana_al_flojo"));
        String primera = (String) ((List<Map<String, Object>>) r.get("arbol")).get(0).get("variable");
        assertTrue(primera.equals("pct_habilidades") || primera.equals("nivel_dominio"), "primera pregunta: " + primera);
    }
}
