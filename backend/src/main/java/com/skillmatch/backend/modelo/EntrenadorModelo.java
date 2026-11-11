package com.skillmatch.backend.modelo;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * El modelo predictivo de SkillMatch, de principio a fin, sin Spring ni base de datos
 * (asi se puede probar con una tabla fija y comparar con el script de Python).
 *
 * Sigue el PDF: arbol CART (4 niveles, 5 casos por hoja), regresion logistica y modelo flojo,
 * validacion cruzada de 5 pliegues, minimo 30 respondidas con 8 y 8, notas, importancia y
 * "habilidades que suelen ir juntas". Devuelve el mismo contenido que modelo-predictivo.json.
 */
public final class EntrenadorModelo {

    public static final int PROFUNDIDAD = 4, CASOS_POR_HOJA = 5, PLIEGUES = 5, MIN_TOTAL = 30, MIN_POR_CLASE = 8;
    public static final long SEMILLA = 42;
    public static final double BUENAS = 0.60, REGULARES = 0.40, MARGEN = 0.02;

    /** id, nombre, icono, tipo, explicacion (igual que VARIABLES en entrenar_modelo.py) */
    public static final String[][] VARIABLES = {
        {"pct_habilidades", "Habilidades que tiene de las pedidas", "target", "entero", "Cuántas de las habilidades que pide la vacante tiene la persona, en porcentaje."},
        {"nivel_dominio", "Qué tan bien las domina", "star", "decimal", "Promedio del nivel de esas habilidades: 1 básico, 2 intermedio, 3 avanzado, 4 experto."},
        {"anos_experiencia", "Años de experiencia", "briefcase", "decimal", "La suma de las experiencias que registró en su perfil."},
        {"alcanza_experiencia", "Su experiencia alcanza lo que pide", "check", "si_no", "Si los años que tiene alcanzan el nivel que pide la vacante."},
        {"num_estudios", "Estudios registrados", "cap", "entero", "Cuántos estudios agregó a su perfil."},
        {"perfil_completo", "Qué tan completo está su perfil", "user", "entero", "Los mismos 5 puntos del anillo de progreso del perfil, en porcentaje."},
        {"tiene_carta", "Escribió carta", "mail", "si_no", "Si la postulación lleva carta de presentación."},
        {"palabras_carta", "Largo de la carta", "pencil", "entero", "Cuántas palabras tiene la carta."},
        {"misma_ciudad", "Vive en la ciudad de la vacante", "pin", "si_no", "Si vive en la misma ciudad de la vacante, o si la vacante es remota."},
        {"tipo_empleo", "Vacante de empleo", "building", "si_no", "Tipo de vacante: empleo."},
        {"tipo_practica", "Vacante de práctica", "book", "si_no", "Tipo de vacante: práctica."},
        {"tipo_freelance", "Vacante independiente", "rocket", "si_no", "Tipo de vacante: independiente (freelance)."},
        {"dias_para_postularse", "Qué tan rápido se postuló", "clock", "entero", "Días entre la publicación de la vacante y la postulación."},
        {"postulantes_vacante", "Cuánta gente se postuló", "users", "entero", "Cuántas personas se postularon a esa vacante."},
    };
    public static final List<String> COLUMNAS;
    static {
        List<String> c = new ArrayList<>();
        for (String[] v : VARIABLES) c.add(v[0]);
        COLUMNAS = List.copyOf(c);
    }

    private EntrenadorModelo() { }

    /** Entrena con pliegues al azar (estratificados, semilla fija). */
    public static Map<String, Object> entrenar(List<Map<String, Number>> filas, List<List<String>> vacantes,
                                               String fuente, boolean sinEjemplos) {
        return entrenar(filas, vacantes, fuente, sinEjemplos, null);
    }

    /**
     * pliegues: el grupo de examen de cada fila. Si es null se reparten al azar. Las pruebas le
     * pasan los mismos grupos que uso Python para comparar resultado por resultado.
     */
    public static Map<String, Object> entrenar(List<Map<String, Number>> filasTodas, List<List<String>> vacantes,
                                               String fuente, boolean sinEjemplos, int[] pliegues) {
        int deEjemplo = (int) filasTodas.stream().filter(f -> num(f, "es_ejemplo") == 1).count();
        List<Map<String, Number>> filas = sinEjemplos
                ? filasTodas.stream().filter(f -> num(f, "es_ejemplo") == 0).toList() : filasTodas;
        int n = filas.size();
        double[][] x = new double[n][COLUMNAS.size()];
        int[] y = new int[n];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < COLUMNAS.size(); j++) x[i][j] = num(filas.get(i), COLUMNAS.get(j));
            y[i] = (int) num(filas.get(i), "aceptada");
        }
        int acept = 0;
        for (int v : y) acept += v;
        int rech = n - acept;
        int faltan = Math.max(0, Math.max(MIN_TOTAL - n, Math.max(MIN_POR_CLASE - acept, MIN_POR_CLASE - rech)));

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("version", 1);
        r.put("fecha", LocalDateTime.now(ZoneId.of("America/Bogota")).truncatedTo(ChronoUnit.MINUTES).toString());
        r.put("fuente", fuente);
        r.put("motor", "java");
        r.put("demostracion", "semilla".equals(fuente) || (!sinEjemplos && deEjemplo > 0));
        Map<String, Object> datos = new LinkedHashMap<>();
        datos.put("respondidas", n);
        datos.put("aceptadas", acept);
        datos.put("rechazadas", rech);
        datos.put("de_ejemplo", sinEjemplos ? 0 : deEjemplo);
        datos.put("minimo", Map.of("total", MIN_TOTAL, "por_clase", MIN_POR_CLASE));
        datos.put("faltan", faltan);
        r.put("datos", datos);
        List<Map<String, Object>> vars = new ArrayList<>();
        for (String[] v : VARIABLES) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", v[0]); m.put("nombre", v[1]); m.put("icono", v[2]); m.put("tipo", v[3]); m.put("explicacion", v[4]);
            vars.add(m);
        }
        r.put("variables", vars);
        Map<String, Object> param = new LinkedHashMap<>();
        param.put("algoritmo", "CART (Java, sin librerías; comprobado contra scikit-learn)");
        param.put("profundidad_maxima", PROFUNDIDAD);
        param.put("casos_por_hoja", CASOS_POR_HOJA);
        param.put("pliegues", PLIEGUES);
        param.put("semilla", SEMILLA);
        r.put("parametros", param);
        r.put("niveles", Map.of("buenas", BUENAS, "regulares", REGULARES));
        r.put("habilidades_juntas", HabilidadesJuntas.reglas(vacantes));

        if (faltan > 0) {
            r.put("estado", "esperando");
            r.put("dar_consejos", false);
            return r;
        }

        // ---------- El examen: 5 pliegues ----------
        int[] grupo = pliegues != null ? pliegues : Pliegues.estratificados(y, PLIEGUES, SEMILLA);
        double[] probArbol = new double[n], probLog = new double[n], probFlojo = new double[n];
        int[] dijoArbol = new int[n], dijoLog = new int[n], dijoFlojo = new int[n];
        for (int g = 0; g < PLIEGUES; g++) {
            List<Integer> estudia = new ArrayList<>(), examen = new ArrayList<>();
            for (int i = 0; i < n; i++) (grupo[i] == g ? examen : estudia).add(i);
            if (examen.isEmpty()) continue;
            double[][] xe = new double[estudia.size()][];
            int[] ye = new int[estudia.size()];
            int unos = 0;
            for (int k = 0; k < estudia.size(); k++) { xe[k] = x[estudia.get(k)]; ye[k] = y[estudia.get(k)]; unos += ye[k]; }
            ArbolCart arbol = new ArbolCart(PROFUNDIDAD, CASOS_POR_HOJA).entrenar(xe, ye);
            RegresionLogistica log = new RegresionLogistica().entrenar(xe, ye);
            int masComun = unos * 2 > estudia.size() ? 1 : 0;      // empate: rechazada (como scikit-learn)
            for (int i : examen) {
                probArbol[i] = arbol.probAceptada(x[i]);
                probLog[i] = log.probAceptada(x[i]);
                probFlojo[i] = masComun;
            }
        }
        int modaGlobal = acept * 2 > n ? 1 : 0;
        for (int i = 0; i < n; i++) {
            dijoArbol[i] = probArbol[i] >= 0.5 ? 1 : 0;
            dijoLog[i] = probLog[i] >= 0.5 ? 1 : 0;
            dijoFlojo[i] = modaGlobal;
        }
        Map<String, Object> modelos = new LinkedHashMap<>();
        Map<String, Double> notasArbol = Metricas.calcular(y, dijoArbol, probArbol);
        Map<String, Double> notasLog = Metricas.calcular(y, dijoLog, probLog);
        Map<String, Double> notasFlojo = Metricas.calcular(y, dijoFlojo, probFlojo);
        modelos.put("arbol", notasArbol);
        modelos.put("logistica", notasLog);
        modelos.put("flojo", notasFlojo);
        int[] m = Metricas.matriz(y, dijoArbol);
        String ganador = notasLog.get("f1") > notasArbol.get("f1") ? "logistica" : "arbol";
        boolean leGana = notasArbol.get("exactitud") >= notasFlojo.get("exactitud") + MARGEN;

        // ---------- El modelo final: aprende con todas ----------
        ArbolCart arbol = new ArbolCart(PROFUNDIDAD, CASOS_POR_HOJA).entrenar(x, y);
        RegresionLogistica log = new RegresionLogistica().entrenar(x, y);
        double[] imp = arbol.importancia();
        List<Map<String, Object>> importancia = new ArrayList<>();
        for (int j = 0; j < imp.length; j++) {
            if (imp[j] <= 0) continue;
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("id", VARIABLES[j][0]); e.put("nombre", VARIABLES[j][1]); e.put("valor", Metricas.redondear(imp[j]));
            importancia.add(e);
        }
        importancia.sort(Comparator.comparingDouble(e -> -((Double) e.get("valor"))));

        Map<String, Object> examen = new LinkedHashMap<>();
        examen.put("pliegues", PLIEGUES);
        examen.put("modelos", modelos);
        examen.put("ganador", ganador);
        examen.put("le_gana_al_flojo", leGana);
        examen.put("margen", MARGEN);
        examen.put("clase_mas_comun", modaGlobal == 1 ? "aceptada" : "rechazada");
        examen.put("matriz", Map.of("vp", m[0], "vn", m[1], "fp", m[2], "fn", m[3]));

        r.put("estado", "listo");
        r.put("dar_consejos", leGana);
        r.put("examen", examen);
        r.put("importancia", importancia);
        r.put("arbol", arbolAJson(arbol));
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("variables", COLUMNAS);
        l.put("media", redondearTodos(log.media(), 6));
        l.put("escala", redondearTodos(log.escala(), 6));
        l.put("coef", redondearTodos(log.coef(), 6));
        l.put("intercepto", BigDecimal.valueOf(log.intercepto()).setScale(6, RoundingMode.HALF_EVEN).doubleValue());
        r.put("logistica", l);
        return r;
    }

    static String posibilidad(double p) { return p >= BUENAS ? "buenas" : (p >= REGULARES ? "regulares" : "bajas"); }

    static List<Map<String, Object>> arbolAJson(ArbolCart arbol) {
        List<Map<String, Object>> salida = new ArrayList<>();
        for (ArbolCart.Nodo n : arbol.nodos()) {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("id", n.id);
            e.put("n", n.n);
            e.put("aceptadas", n.aceptadas);
            e.put("prob", Metricas.redondear(n.prob()));
            e.put("posibilidad", posibilidad(n.prob()));
            if (n.esHoja()) {
                e.put("hoja", true);
            } else {
                String var = COLUMNAS.get(n.variable);
                String[] t = textosDelCorte(var, n.umbral);
                e.put("variable", var);
                e.put("umbral", Metricas.redondear(n.umbral));
                e.put("pregunta", t[0]);
                e.put("frase_si", t[1]);
                e.put("frase_no", t[2]);
                e.put("si", n.derecha);
                e.put("no", n.izquierda);
            }
            salida.add(e);
        }
        return salida;
    }

    /** La pregunta y sus dos frases, en positivo: "si" = x > umbral (igual que textos_del_corte en Python). */
    static String[] textosDelCorte(String var, double umbral) {
        int c = (int) Math.floor(umbral) + 1;
        String d = new BigDecimal(umbral).setScale(1, RoundingMode.HALF_EVEN).toPlainString().replace('.', ',');
        String est = c == 1 ? "estudio" : "estudios";
        return switch (var) {
            case "pct_habilidades" -> new String[] {"¿Tiene al menos el " + c + " % de las habilidades que pide?",
                    "tienen al menos el " + c + " % de las habilidades pedidas", "tienen menos del " + c + " % de las habilidades pedidas"};
            case "nivel_dominio" -> new String[] {"¿Su nivel en esas habilidades pasa de " + d + " (de 4)?",
                    "dominan esas habilidades por encima de " + d + " (de 4)", "las dominan en " + d + " o menos (de 4)"};
            case "anos_experiencia" -> new String[] {"¿Tiene más de " + d + " años de experiencia?",
                    "tienen más de " + d + " años de experiencia", "tienen " + d + " años de experiencia o menos"};
            case "alcanza_experiencia" -> new String[] {"¿Su experiencia alcanza lo que pide la vacante?",
                    "tienen la experiencia que pide la vacante", "no alcanzan la experiencia que pide la vacante"};
            case "num_estudios" -> new String[] {"¿Registró al menos " + c + " " + est + "?",
                    "registran al menos " + c + " " + est, "registran menos de " + c + " " + est};
            case "perfil_completo" -> new String[] {"¿Tiene el perfil completo al " + c + " % o más?",
                    "tienen el perfil completo al " + c + " % o más", "tienen el perfil completo a menos del " + c + " %"};
            case "tiene_carta" -> new String[] {"¿Escribió carta?", "llevan carta", "no llevan carta"};
            case "palabras_carta" -> new String[] {"¿La carta tiene " + c + " palabras o más?",
                    "llevan una carta de " + c + " palabras o más", "llevan una carta de menos de " + c + " palabras (o ninguna)"};
            case "misma_ciudad" -> new String[] {"¿Vive en la ciudad de la vacante (o es remota)?",
                    "son de personas que viven en la ciudad de la vacante (o es remota)", "son de personas que viven en otra ciudad"};
            case "tipo_empleo" -> new String[] {"¿Es una vacante de empleo?", "son a vacantes de empleo", "son a vacantes que no son de empleo"};
            case "tipo_practica" -> new String[] {"¿Es una vacante de práctica?", "son a vacantes de práctica", "son a vacantes que no son de práctica"};
            case "tipo_freelance" -> new String[] {"¿Es una vacante independiente?", "son a vacantes independientes", "son a vacantes que no son independientes"};
            case "dias_para_postularse" -> new String[] {"¿Se postuló " + c + " días o más después de publicada?",
                    "llegan " + c + " días o más después de publicada la vacante", "llegan en los primeros " + c + " días de publicada la vacante"};
            case "postulantes_vacante" -> new String[] {"¿La vacante tiene " + c + " postulantes o más?",
                    "son a vacantes con " + c + " postulantes o más", "son a vacantes con menos de " + c + " postulantes"};
            default -> new String[] {"¿" + var + " > " + d + "?", var + " > " + d, var + " ≤ " + d};
        };
    }

    private static double num(Map<String, Number> f, String col) {
        Number v = f.get(col);
        return v == null ? 0 : v.doubleValue();
    }

    private static List<Double> redondearTodos(double[] v, int dec) {
        List<Double> l = new ArrayList<>();
        for (double d : v) l.add(BigDecimal.valueOf(d).setScale(dec, RoundingMode.HALF_EVEN).doubleValue());
        return l;
    }

    /**
     * Extra opcional del PDF: "habilidades que suelen ir juntas" (reglas de asociacion).
     * Mira las habilidades que piden las vacantes: "las vacantes que piden A suelen pedir B".
     */
    public static final class HabilidadesJuntas {
        public static final int MIN_VACANTES = 3;
        public static final double MIN_CONFIANZA = 0.30;
        public static final int MAXIMO = 10;

        private HabilidadesJuntas() { }

        public static List<Map<String, Object>> reglas(List<List<String>> vacantes) {
            if (vacantes == null) return List.of();
            Map<String, String> nombre = new HashMap<>();
            Map<String, Integer> cuenta = new HashMap<>();
            Map<String, Integer> pares = new HashMap<>();
            int total = 0;
            for (List<String> v : vacantes) {
                Set<String> hs = new LinkedHashSet<>();
                for (String h : v) {
                    String k = h.trim().toLowerCase(Locale.ROOT);
                    if (k.isEmpty()) continue;
                    hs.add(k);
                    nombre.putIfAbsent(k, h.trim());
                }
                if (hs.isEmpty()) continue;
                total++;
                for (String a : hs) {
                    cuenta.merge(a, 1, Integer::sum);
                    for (String b : hs) if (!a.equals(b)) pares.merge(a + "\u0000" + b, 1, Integer::sum);
                }
            }
            List<Map<String, Object>> reglas = new ArrayList<>();
            for (Map.Entry<String, Integer> e : pares.entrySet()) {
                String[] ab = e.getKey().split("\u0000");
                int juntas = e.getValue();
                double confianza = (double) juntas / cuenta.get(ab[0]);
                double lift = confianza / ((double) cuenta.get(ab[1]) / total);
                if (juntas < MIN_VACANTES || confianza < MIN_CONFIANZA || lift <= 1) continue;
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("si", nombre.get(ab[0]));
                r.put("entonces", nombre.get(ab[1]));
                r.put("vacantes", juntas);
                r.put("confianza", Metricas.redondear(confianza));
                r.put("lift", Metricas.redondear(lift));
                r.put("_si", ab[0]);
                r.put("_entonces", ab[1]);
                r.put("_l", lift);
                r.put("_c", confianza);
                reglas.add(r);
            }
            reglas.sort(Comparator.<Map<String, Object>>comparingDouble(r -> -(double) r.get("_l"))
                    .thenComparingDouble(r -> -(double) r.get("_c"))
                    .thenComparing(r -> (String) r.get("_si"))
                    .thenComparing(r -> (String) r.get("_entonces")));
            List<Map<String, Object>> salida = new ArrayList<>();
            for (Map<String, Object> r : reglas.subList(0, Math.min(MAXIMO, reglas.size()))) {
                r.keySet().removeIf(k -> k.startsWith("_"));
                salida.add(r);
            }
            return salida;
        }
    }
}
