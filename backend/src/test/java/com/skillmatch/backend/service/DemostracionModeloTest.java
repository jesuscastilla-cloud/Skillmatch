package com.skillmatch.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.junit.jupiter.api.Test;

import com.skillmatch.backend.config.DemostracionModelo;
import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ApplicationStatus;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.Skill;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.modelo.EntrenadorModelo;
import com.skillmatch.backend.repository.ApplicationRepository;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.JobRepository;
import com.skillmatch.backend.repository.UserRepository;

/**
 * Los datos de demostracion alcanzan para que el modelo funcione: hay suficientes respuestas de los
 * dos tipos y, como siguen una regla, el arbol la encuentra y le gana al modelo flojo. Y con las
 * respuestas al azar (lo que hacia el DataSeeder antes) NO le gana: asi se sabe que el modelo no
 * inventa patrones.
 */
class DemostracionModeloTest {

    // Lo mismo que el DataSeeder: 150 personas con 2 a 5 habilidades de una lista de 40, 120 vacantes con 3 a 7
    private static final String[] HABILIDADES = {"Java", "Spring Boot", "JavaScript", "React", "Angular", "Vue.js",
        "Node.js", "Python", "Django", "Flask", "PHP", "Laravel", "C#", ".NET", "Ruby", "Rails", "Go", "Kotlin",
        "Swift", "Flutter", "React Native", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "MySQL", "PostgreSQL",
        "MongoDB", "Redis", "Git", "CI/CD", "Agile", "Scrum", "REST API", "GraphQL", "Microservices", "TDD",
        "Design Patterns", "SQL"};
    private static final String[] CIUDADES = {"Cartagena", "Bogotá", "Medellín", "Cali", "Barranquilla",
        "Bucaramanga", "Pereira", "Manizales", "Santa Marta", "Ibagué"};

    private final TablaEjemplosService tabla = new TablaEjemplosService(
            mock(ApplicationRepository.class), mock(UserRepository.class), mock(JobRepository.class), mock(CompanyRepository.class));

    private List<Map<String, Number>> filas(boolean respuestasAlAzar) {
        Random r = new Random(1);
        LocalDateTime ahora = LocalDateTime.now();
        List<User> personas = new ArrayList<>();
        for (int i = 0; i < 150; i++) {
            User u = new User();
            u.setId("u" + i);
            u.setEmail("demo" + i + "@skillmatch.test");
            u.setFirstName("Demo");
            u.setLastName("Persona");
            u.setPhone("+57 300");
            u.setLocation(CIUDADES[r.nextInt(CIUDADES.length)]);
            java.util.Set<String> elegidas = new java.util.LinkedHashSet<>();
            int cuantas = r.nextInt(4) + 2;
            while (elegidas.size() < cuantas) elegidas.add(HABILIDADES[r.nextInt(HABILIDADES.length)]);
            List<Skill> suyas = new ArrayList<>();
            for (String h : elegidas) { Skill s = new Skill(); s.setName(h); s.setLevel("INTERMEDIO"); suyas.add(s); }
            u.setSkills(suyas);
            u.setExperiences(DemostracionModelo.experiencias(r));
            u.setEducations(DemostracionModelo.estudios(r));
            personas.add(u);
        }
        List<Job> vacantes = new ArrayList<>();
        for (int i = 0; i < 120; i++) {
            Job j = new Job();
            j.setId("j" + i);
            j.setTitle("Vacante " + i);
            j.setLocation(CIUDADES[r.nextInt(CIUDADES.length)]);
            j.setType(new String[] {"empleo", "práctica", "freelance"}[r.nextInt(3)]);
            j.setExperienceLevel(new String[] {"sin-experiencia", "junior", "semi-senior", "senior"}[r.nextInt(4)]);
            j.setModality(new String[] {"presencial", "remoto", "híbrido"}[r.nextInt(3)]);
            j.setPostedDate(ahora.minusDays(r.nextInt(90)));
            List<String> pide = new ArrayList<>();
            for (int k = 0, n = r.nextInt(5) + 3; k < n; k++) pide.add(HABILIDADES[r.nextInt(HABILIDADES.length)]);
            j.setSkills(pide);
            vacantes.add(j);
        }
        List<Map<String, Number>> filas = new ArrayList<>();
        java.util.Set<String> vistas = new java.util.HashSet<>();
        for (int i = 0; i < 500; i++) {
            User u = personas.get(r.nextInt(personas.size()));
            Job v = DemostracionModelo.elegirVacante(u, vacantes, r);
            if (!vistas.add(u.getId() + v.getId())) continue;
            Application a = DemostracionModelo.postulacion(u, v, r, ahora);
            if (a.getStatus() != ApplicationStatus.ACEPTADA && a.getStatus() != ApplicationStatus.RECHAZADA) continue;
            if (respuestasAlAzar) a.setStatus(r.nextBoolean() ? ApplicationStatus.ACEPTADA : ApplicationStatus.RECHAZADA);
            int numero = vacantes.indexOf(v);
            long antes = filas.stream().filter(f -> f.get("vacante").intValue() == numero).count();
            Map<String, Number> f = tabla.caracteristicas(a, u, v, "", antes);
            f.put("vacante", numero);
            filas.add(f);
        }
        return filas;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> examen(Map<String, Object> modelo) {
        return (Map<String, Object>) modelo.get("examen");
    }

    @Test
    void hayRespuestasDeLosDosTiposYElModeloAprende() {
        List<Map<String, Number>> filas = filas(false);
        long aceptadas = filas.stream().filter(f -> f.get("aceptada").intValue() == 1).count();
        assertThat(filas.size()).as("respondidas").isGreaterThanOrEqualTo(250);
        assertThat((double) aceptadas / filas.size()).as("proporcion de aceptadas").isBetween(0.25, 0.75);

        Map<String, Object> modelo = EntrenadorModelo.entrenar(filas, List.of(), "plataforma", false);
        assertThat(modelo.get("estado")).isEqualTo("listo");
        assertThat(examen(modelo).get("le_gana_al_flojo")).as("el arbol le gana al modelo flojo").isEqualTo(true);
        assertThat(modelo.get("demostracion")).as("los datos de ejemplo se marcan como Demostración").isEqualTo(true);
    }

    @Test
    void conRespuestasAlAzarElModeloNoInventaPatrones() {
        Map<String, Object> modelo = EntrenadorModelo.entrenar(filas(true), List.of(), "plataforma", false);
        assertThat(examen(modelo).get("le_gana_al_flojo")).isEqualTo(false);
        assertThat(modelo.get("dar_consejos")).isEqualTo(false);
    }

    @Test
    void laReglaPremiaLoQueDice() {
        double mucho = DemostracionModelo.probabilidadDeAceptar(1.0, true, true, true, 2);
        double poco = DemostracionModelo.probabilidadDeAceptar(0.0, false, false, false, 40);
        assertThat(mucho).isGreaterThan(0.8);
        assertThat(poco).isLessThan(0.1);
    }
}
