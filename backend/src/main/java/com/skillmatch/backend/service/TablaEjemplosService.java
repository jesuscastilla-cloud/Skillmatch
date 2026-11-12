package com.skillmatch.backend.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ApplicationStatus;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Experience;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.Skill;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.ApplicationRepository;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.JobRepository;
import com.skillmatch.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Modelo predictivo, paso 2 del PDF: "la tabla de ejemplos".
 *
 * Junta cada postulacion RESPONDIDA (aceptada o rechazada) con lo que se mira de ella y la
 * devuelve como CSV. Es la misma tabla que arma 1-datos/caracteristicas.py, columna por
 * columna, para que el script de Python pueda leerla sin entrar directo a MongoDB.
 *
 * Tambien calcula esas mismas columnas para las postulaciones EN PROCESO de la persona que
 * inicio sesion (misPostulaciones): con eso el navegador recorre el arbol y pinta el recuadro.
 *
 * Nunca sale: nombre, correo, telefono, foto, edad, sexo ni que empresa es.
 */
@Service
@RequiredArgsConstructor
public class TablaEjemplosService {

    public static final String CABECERA = String.join(",",
            "pct_habilidades", "nivel_dominio", "anos_experiencia", "alcanza_experiencia",
            "num_estudios", "perfil_completo", "tiene_carta", "palabras_carta", "misma_ciudad",
            "tipo_empleo", "tipo_practica", "tipo_freelance", "dias_para_postularse",
            "postulantes_previos", "vacante", "es_ejemplo", "aceptada");

    private static final Map<String, Integer> NIVELES = Map.of(
            "BASICO", 1, "INTERMEDIO", 2, "AVANZADO", 3, "EXPERTO", 4);
    private static final Map<String, Integer> ANOS_QUE_PIDE = Map.of(
            "sin-experiencia", 0, "junior", 0, "semi-senior", 1, "senior", 3);

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final JobRepository jobRepository;
    private final CompanyRepository companyRepository;

    /** La tabla en CSV (la descarga el ADMIN para el script de Python). */
    public String comoCsv() {
        StringBuilder csv = new StringBuilder(CABECERA).append('\n');
        for (Map<String, Number> f : filas()) {
            csv.append(f.values().stream().map(String::valueOf).collect(Collectors.joining(","))).append('\n');
        }
        return csv.toString();
    }

    /** Una fila por postulacion RESPONDIDA, con las 16 columnas de CABECERA (la usa el modelo de Java). */
    public List<Map<String, Number>> filas() {
        List<Application> postulaciones = applicationRepository.findAll();
        Map<String, User> usuarios = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        Map<String, Job> vacantes = jobRepository.findAll().stream()
                .collect(Collectors.toMap(Job::getId, Function.identity()));
        Map<String, String> empresas = companyRepository.findAll().stream()
                .collect(Collectors.toMap(Company::getId, c -> c.getName() == null ? "" : c.getName()));
        // Cuando se postulo cada quien, por vacante: para contar solo a los que llegaron ANTES
        Map<String, List<LocalDateTime>> fechasPorVacante = postulaciones.stream()
                .filter(a -> a.getJobId() != null && fecha(a) != null)
                .collect(Collectors.groupingBy(Application::getJobId,
                        Collectors.mapping(TablaEjemplosService::fecha, Collectors.toList())));
        // Cada vacante pasa a ser un numero (arma el examen por vacante), sin su id real
        Map<String, Integer> numeroVacante = new HashMap<>();

        List<Map<String, Number>> filas = new ArrayList<>();
        for (Application a : postulaciones) {
            if (a.getStatus() != ApplicationStatus.ACEPTADA && a.getStatus() != ApplicationStatus.RECHAZADA) continue;
            User u = usuarios.get(a.getUserId());
            Job v = vacantes.get(a.getJobId());
            if (u == null || v == null) continue;
            Map<String, Number> f = caracteristicas(a, u, v, empresas.getOrDefault(v.getCompanyId(), ""),
                    antes(fechasPorVacante.get(a.getJobId()), fecha(a)));
            f.put("vacante", numeroVacante.computeIfAbsent(a.getJobId(), id -> numeroVacante.size()));
            // "vacante" va antes de es_ejemplo y aceptada, como en la CABECERA
            Number ejemplo = f.remove("es_ejemplo"), aceptada = f.remove("aceptada");
            f.put("es_ejemplo", ejemplo);
            f.put("aceptada", aceptada);
            filas.add(f);
        }
        return filas;
    }

    /** Las habilidades que pide cada vacante (para "habilidades que suelen ir juntas"). */
    public List<List<String>> habilidadesDeVacantes() {
        return jobRepository.findAll().stream()
                .map(v -> lista(v.getSkills()).stream().map(TablaEjemplosService::texto)
                        .filter(h -> !h.isEmpty()).toList())
                .toList();
    }

    /**
     * Las postulaciones de esta persona que siguen en proceso (enviada o revisada), cada una
     * con sus caracteristicas. Solo las suyas: la empresa nunca ve esto.
     */
    public List<Map<String, Object>> misPostulaciones(String userId) {
        User u = userRepository.findById(userId).orElse(null);
        if (u == null) return List.of();
        List<Map<String, Object>> salida = new ArrayList<>();
        for (Application a : applicationRepository.findByUserId(userId)) {
            if (a.getStatus() != ApplicationStatus.PENDIENTE && a.getStatus() != ApplicationStatus.REVISADA) continue;
            Map<String, Object> item = unaPostulacion(a, u);
            if (item != null) salida.add(item);
        }
        return salida;
    }

    /**
     * Una postulacion con sus caracteristicas (sin es_ejemplo ni aceptada) y las habilidades que la
     * vacante pide y la persona no tiene. Sirve para el recuadro y para el consejo del correo.
     */
    public Map<String, Object> unaPostulacion(Application a, User u) {
        if (u == null) u = userRepository.findById(a.getUserId()).orElse(null);
        Job v = a.getJobId() == null ? null : jobRepository.findById(a.getJobId()).orElse(null);
        if (u == null || v == null) return null;
        List<LocalDateTime> fechas = applicationRepository.findByJobId(v.getId()).stream()
                .map(TablaEjemplosService::fecha).filter(java.util.Objects::nonNull).toList();
        Map<String, Number> f = caracteristicas(a, u, v, "", antes(fechas, fecha(a)));
        f.remove("es_ejemplo");
        f.remove("aceptada");
        // Las habilidades que pide y no tiene: para el consejo "te falta Ingles basico"
        Set<String> suyas = lista(u.getSkills()).stream().map(s -> norm(s.getName())).collect(Collectors.toSet());
        List<String> faltan = lista(v.getSkills()).stream().distinct().filter(h -> !suyas.contains(norm(h))).toList();
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("applicationId", a.getId());
        item.put("caracteristicas", f);
        item.put("faltan", faltan);
        return item;
    }

    /** Cuando se postulo: la fecha de la postulacion o, si falta, cuando se creo. */
    static LocalDateTime fecha(Application a) {
        return a.getAppliedDate() != null ? a.getAppliedDate() : a.getCreatedAt();
    }

    /**
     * Cuantas personas se habian postulado a la vacante ANTES que esta. Las que llegaron despues
     * no cuentan: es informacion del futuro que no se tiene al postularse (fuga de datos).
     */
    static long antes(List<LocalDateTime> fechas, LocalDateTime cuando) {
        if (fechas == null || cuando == null) return 0;
        return fechas.stream().filter(f -> f.isBefore(cuando)).count();
    }

    /** Una fila de la tabla, en el orden de CABECERA sin "vacante" (el mismo de caracteristicas.py). */
    Map<String, Number> caracteristicas(Application a, User u, Job v, String empresa, long postulantesPrevios) {
        // 1) Habilidades que tiene de las pedidas y su nivel
        Set<String> pedidas = lista(v.getSkills()).stream().map(TablaEjemplosService::norm)
                .filter(s -> !s.isEmpty()).collect(Collectors.toSet());
        Map<String, Integer> suyas = new HashMap<>();
        for (Skill s : lista(u.getSkills())) {
            String n = norm(s.getName());
            if (!n.isEmpty()) suyas.put(n, NIVELES.getOrDefault(sinTildes(texto(s.getLevel())), 1));
        }
        List<Integer> coinciden = new ArrayList<>();
        pedidas.forEach(h -> { if (suyas.containsKey(h)) coinciden.add(suyas.get(h)); });
        long pct = pedidas.isEmpty() ? 0 : (long) Math.floor(100.0 * coinciden.size() / pedidas.size() + 0.5);
        double nivel = coinciden.isEmpty() ? 0
                : Math.round(coinciden.stream().mapToInt(Integer::intValue).average().orElse(0) * 100) / 100.0;

        // 2) Experiencia
        double anos = anosDeExperiencia(lista(u.getExperiences()));
        int minimo = ANOS_QUE_PIDE.getOrDefault(texto(v.getExperienceLevel()), 0);

        // 3) Carta
        String carta = texto(a.getCoverLetter());
        int palabras = carta.isEmpty() ? 0 : carta.split("\\s+").length;

        // 4) Ciudad o remota
        String cu = norm(u.getLocation()), cv = norm(v.getLocation());
        boolean misma = "remoto".equals(norm(v.getModality()))
                || (!cu.isEmpty() && !cv.isEmpty() && (cu.contains(cv) || cv.contains(cu)));

        // 5) Rapidez
        LocalDateTime publicada = v.getPostedDate() != null ? v.getPostedDate() : v.getCreatedAt();
        LocalDateTime postulo = a.getAppliedDate() != null ? a.getAppliedDate() : a.getCreatedAt();
        long dias = publicada != null && postulo != null ? Math.max(0, Duration.between(publicada, postulo).toDays()) : 0;

        String tipo = norm(v.getType());
        boolean ejemplo = empresa.toLowerCase(Locale.ROOT).contains("(ejemplo)")
                || norm(u.getEmail()).endsWith("@skillmatch.test");

        int completo = (int) Math.floor(100.0 * (
                b(u.getFirstName() != null && u.getLastName() != null && u.getEmail() != null)
                + b(u.getPhone() != null && !u.getPhone().isBlank())
                + b(!lista(u.getSkills()).isEmpty()) + b(!lista(u.getExperiences()).isEmpty())
                + b(!lista(u.getEducations()).isEmpty())) / 5 + 0.5);

        Map<String, Number> f = new LinkedHashMap<>();
        f.put("pct_habilidades", pct);
        f.put("nivel_dominio", nivel);
        f.put("anos_experiencia", anos);
        f.put("alcanza_experiencia", b(anos >= minimo));
        f.put("num_estudios", lista(u.getEducations()).size());
        f.put("perfil_completo", completo);
        f.put("tiene_carta", b(palabras > 0));
        f.put("palabras_carta", palabras);
        f.put("misma_ciudad", b(misma));
        f.put("tipo_empleo", b("empleo".equals(tipo)));
        f.put("tipo_practica", b("práctica".equals(tipo) || "practica".equals(tipo)));
        f.put("tipo_freelance", b("freelance".equals(tipo) || "independiente".equals(tipo)));
        f.put("dias_para_postularse", dias);
        f.put("postulantes_previos", postulantesPrevios);
        f.put("es_ejemplo", b(ejemplo));
        f.put("aceptada", b(a.getStatus() == ApplicationStatus.ACEPTADA));
        return f;
    }

    private static double anosDeExperiencia(List<Experience> experiencias) {
        LocalDate hoy = LocalDate.now();
        long dias = 0;
        for (Experience e : experiencias) {
            if (e.getStartDate() == null) continue;
            LocalDate fin = Boolean.TRUE.equals(e.getIsCurrent()) || e.getEndDate() == null ? hoy : e.getEndDate();
            dias += Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(e.getStartDate(), fin));
        }
        return Math.round(dias / 365.0 * 10) / 10.0;
    }

    private static int b(boolean v) { return v ? 1 : 0; }
    private static <T> List<T> lista(List<T> l) { return l == null ? List.of() : l; }
    private static String texto(String s) { return s == null ? "" : s.trim(); }
    private static String norm(String s) { return texto(s).toLowerCase(Locale.ROOT); }
    private static String sinTildes(String s) {
        return java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toUpperCase(Locale.ROOT);
    }
}
