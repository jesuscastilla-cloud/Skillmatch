package com.skillmatch.backend.config;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.Set;

import org.bson.types.ObjectId;

import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ApplicationStatus;
import com.skillmatch.backend.model.Education;
import com.skillmatch.backend.model.Experience;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.User;

/**
 * Datos de DEMOSTRACION para el modelo predictivo.
 *
 * El modelo aprende de las postulaciones que una empresa ya acepto o rechazo. Mientras no haya
 * suficientes respuestas reales (minimo 30, con 8 de cada tipo) se pueden cargar respuestas de
 * ejemplo para ver el modelo aprendiendo. NO son respuestas de empresas reales: cada una sale de
 * una regla sencilla, escrita aqui abajo en {@link #probabilidadDeAceptar}, con algo de azar:
 *
 *   mas habilidades de las pedidas, carta de 20 palabras o mas, experiencia suficiente y vivir en
 *   la ciudad de la vacante hacen mas probable que la respuesta sea "aceptada"; tardar en
 *   postularse la hace menos probable.
 *
 * Toda postulacion creada asi lleva ejemplo = true: el modelo las cuenta como "de ejemplo", la
 * pagina "Como aprende SkillMatch" dice "Demostracion", no entran en las cifras publicas y se
 * pueden dejar fuera con MODELO_SIN_EJEMPLOS=true.
 *
 * Lo usan DataSeeder (base nueva) y DatosDemostracionModelo (base que ya tiene datos).
 */
public final class DemostracionModelo {

    private DemostracionModelo() { }

    static final String[] EMPRESAS = {"Comercializadora del Caribe", "Servicios Bolívar", "Hotel Bahía",
        "Distribuidora Cartagena", "Tecnología Costa", "Restaurante Getsemaní"};
    static final String[] CARGOS = {"Auxiliar", "Asistente", "Analista", "Practicante", "Técnico", "Vendedor"};
    static final String[] COLEGIOS = {"SENA", "Universidad de Cartagena", "Universidad Tecnológica de Bolívar",
        "Colegio Técnico Industrial", "Institución Universitaria Mayor de Cartagena"};
    static final String[] TITULOS = {"Bachiller técnico", "Técnico en sistemas", "Tecnólogo en administración",
        "Técnico en gestión comercial", "Profesional en administración"};
    static final String[] NIVELES = {"BÁSICO", "INTERMEDIO", "AVANZADO", "EXPERTO"};
    private static final String[] PALABRAS = {"me", "interesa", "esta", "vacante", "porque", "tengo", "ganas",
        "de", "aprender", "y", "trabajar", "con", "responsabilidad", "puedo", "empezar", "pronto", "gracias",
        "por", "tener", "en", "cuenta", "mi", "hoja", "de", "vida", "estoy", "disponible", "para", "una",
        "entrevista", "cuando", "ustedes", "lo", "necesiten", "soy", "puntual", "y", "dedicado"};

    /** Una persona puede tener de 0 a 3 experiencias, de 6 a 35 meses cada una. */
    public static List<Experience> experiencias(Random r) {
        List<Experience> lista = new ArrayList<>();
        int cuantas = r.nextInt(4);
        LocalDate fin = LocalDate.now().minusMonths(r.nextInt(4));
        for (int i = 0; i < cuantas; i++) {
            Experience e = new Experience();
            e.setId(ObjectId.get().toString());
            e.setCompany(EMPRESAS[r.nextInt(EMPRESAS.length)]);
            e.setPosition(CARGOS[r.nextInt(CARGOS.length)]);
            boolean actual = i == 0 && r.nextInt(10) < 3;
            LocalDate inicio = fin.minusMonths(6 + r.nextInt(30));
            e.setStartDate(inicio);
            e.setIsCurrent(actual);
            e.setEndDate(actual ? null : fin);
            e.setLocation("Cartagena");
            lista.add(e);
            fin = inicio.minusMonths(1 + r.nextInt(6));
        }
        return lista;
    }

    /** De 0 a 2 estudios. */
    public static List<Education> estudios(Random r) {
        List<Education> lista = new ArrayList<>();
        int cuantos = r.nextInt(3);
        for (int i = 0; i < cuantos; i++) {
            Education e = new Education();
            e.setId(ObjectId.get().toString());
            e.setSchool(COLEGIOS[r.nextInt(COLEGIOS.length)]);
            e.setDegree(TITULOS[r.nextInt(TITULOS.length)]);
            e.setIsCurrent(false);
            LocalDate fin = LocalDate.now().minusYears(1 + i * 2L).minusMonths(r.nextInt(10));
            e.setEndDate(fin);
            e.setStartDate(fin.minusYears(1 + r.nextInt(3)));
            lista.add(e);
        }
        return lista;
    }

    private static String norm(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    /** Que parte (0 a 1) de las habilidades que pide la vacante tiene la persona. */
    public static double coincidencia(User u, Job j) {
        Set<String> pedidas = new HashSet<>();
        if (j.getSkills() != null) j.getSkills().forEach(h -> { if (!norm(h).isEmpty()) pedidas.add(norm(h)); });
        if (pedidas.isEmpty() || u.getSkills() == null) return 0;
        Set<String> suyas = new HashSet<>();
        u.getSkills().forEach(s -> suyas.add(norm(s.getName())));
        long tiene = pedidas.stream().filter(suyas::contains).count();
        return (double) tiene / pedidas.size();
    }

    static double anosDeExperiencia(User u) {
        double dias = 0;
        if (u.getExperiences() == null) return 0;
        LocalDate hoy = LocalDate.now();
        for (Experience e : u.getExperiences()) {
            if (e.getStartDate() == null) continue;
            LocalDate fin = Boolean.TRUE.equals(e.getIsCurrent()) || e.getEndDate() == null ? hoy : e.getEndDate();
            dias += Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(e.getStartDate(), fin));
        }
        return dias / 365.0;
    }

    private static int anosQuePide(String nivel) {
        return switch (norm(nivel)) {
            case "semi-senior" -> 1;
            case "senior" -> 3;
            default -> 0;
        };
    }

    private static boolean mismaCiudad(User u, Job j) {
        if ("remoto".equals(norm(j.getModality()))) return true;
        String cu = norm(u.getLocation()), cv = norm(j.getLocation());
        return !cu.isEmpty() && !cv.isEmpty() && (cu.contains(cv) || cv.contains(cu));
    }

    /**
     * LA REGLA de la demostracion: la probabilidad de que la empresa acepte, antes del azar.
     * Es lo unico que decide las respuestas de ejemplo; el modelo tiene que redescubrirla.
     */
    public static double probabilidadDeAceptar(double coincidencia, boolean cartaLarga, boolean alcanzaExperiencia,
                                               boolean mismaCiudad, long diasParaPostularse) {
        double logit = -2.2 + 5.0 * coincidencia + 1.0 * (cartaLarga ? 1 : 0) + 0.8 * (alcanzaExperiencia ? 1 : 0)
                + 0.6 * (mismaCiudad ? 1 : 0) - 0.03 * diasParaPostularse;
        return 1 / (1 + Math.exp(-logit));
    }

    private static String carta(Random r, String cargo, int palabras) {
        if (palabras == 0) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < palabras; i++) sb.append(i == 0 ? "Hola, " : " ").append(PALABRAS[r.nextInt(PALABRAS.length)]);
        return sb.append('.').toString();
    }

    /**
     * Una postulacion de ejemplo: la persona se postula unos dias despues de publicada la vacante,
     * escribe o no una carta, y la empresa la deja en proceso (30 %) o responde segun la regla.
     */
    public static Application postulacion(User u, Job j, Random r, LocalDateTime ahora) {
        LocalDateTime publicada = j.getPostedDate() != null ? j.getPostedDate() : ahora.minusDays(30);
        long maximo = Math.max(0, Math.min(60, Duration.between(publicada, ahora).toDays() - 1));
        long dias = maximo == 0 ? 0 : r.nextInt((int) maximo + 1);
        LocalDateTime cuando = publicada.plusDays(dias).plusHours(r.nextInt(24));
        if (cuando.isAfter(ahora)) cuando = ahora.minusMinutes(5);
        dias = Math.max(0, Duration.between(publicada, cuando).toDays());

        int palabras = r.nextInt(100) < 25 ? 0 : 8 + r.nextInt(55);
        Application a = new Application();
        a.setUserId(u.getId());
        a.setJobId(j.getId());
        a.setAppliedDate(cuando);
        a.setCreatedAt(cuando);
        a.setUpdatedAt(cuando);
        a.setCoverLetter(carta(r, j.getTitle(), palabras));
        a.setEjemplo(true);

        int azar = r.nextInt(100);
        if (azar < 15) {
            a.setStatus(ApplicationStatus.PENDIENTE);
        } else if (azar < 30) {
            a.setStatus(ApplicationStatus.REVISADA);
        } else {
            double p = probabilidadDeAceptar(coincidencia(u, j), palabras >= 20,
                    anosDeExperiencia(u) >= anosQuePide(j.getExperienceLevel()), mismaCiudad(u, j), dias);
            a.setStatus(r.nextDouble() < p ? ApplicationStatus.ACEPTADA : ApplicationStatus.RECHAZADA);
            LocalDateTime revisada = cuando.plusDays(1 + r.nextInt(8));
            a.setReviewedDate(revisada.isAfter(ahora) ? ahora.minusMinutes(1) : revisada);
        }
        return a;
    }

    /**
     * A que vacante se postula una persona: casi siempre una que se parece a lo que sabe hacer
     * (la que mas se parece entre diez al azar) y a veces cualquiera, como pasa en la vida real.
     */
    public static Job elegirVacante(User u, List<Job> vacantes, Random r) {
        Job mejor = vacantes.get(r.nextInt(vacantes.size()));
        if (r.nextInt(10) < 8) {
            for (int i = 0; i < 9; i++) {
                Job otra = vacantes.get(r.nextInt(vacantes.size()));
                if (coincidencia(u, otra) > coincidencia(u, mejor)) mejor = otra;
            }
        }
        return mejor;
    }
}
