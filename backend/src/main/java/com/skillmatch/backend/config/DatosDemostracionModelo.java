package com.skillmatch.backend.config;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.Skill;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.ApplicationRepository;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.JobRepository;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.service.ModeloPredictivoService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Carga respuestas de DEMOSTRACION para el modelo predictivo en una base que YA tiene datos
 * (como la de Render, donde el DataSeeder no corre porque ya hay personas).
 *
 * Se activa con SEED_MODELO_DEMO=true y se deja en false despues del primer arranque. Solo corre
 * una vez: si ya hay postulaciones de demostracion, no hace nada.
 *
 * Lo que crea (todo marcado como ejemplo, ver DemostracionModelo):
 *  - Personas de demostracion: rol DEMO, cuenta desactivada y clave que nadie conoce, correo
 *    demo{n}@skillmatch.test. No pueden entrar, no cuentan en las cifras publicas y nunca se le
 *    sugieren a nadie.
 *  - Postulaciones de esas personas a las vacantes de las empresas «(ejemplo)» (nunca a las de una
 *    empresa de verdad), con respuestas que siguen la regla de demostracion.
 */
@Slf4j
@Component
@Order(3)
@RequiredArgsConstructor
@ConditionalOnProperty(name = "skillmatch.seed.modelo-demo", havingValue = "true")
public class DatosDemostracionModelo implements CommandLineRunner {

    private static final String[] NOMBRES = {"Valeria", "Camilo", "Daniela", "Santiago", "Laura", "Andrés",
        "Mariana", "Julián", "Paula", "Sebastián", "Natalia", "David", "Carolina", "Mateo", "Sara"};
    private static final String[] APELLIDOS = {"Pérez", "Rodríguez", "Gómez", "Martínez", "López", "Herrera",
        "Castro", "Ortega", "Barrios", "Arrieta", "Mendoza", "Padilla", "Villalobos", "Cabarcas"};

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final JobRepository jobRepository;
    private final ApplicationRepository applicationRepository;
    private final PasswordEncoder passwordEncoder;
    private final ModeloPredictivoService modeloPredictivo;

    @Value("${skillmatch.seed.modelo-demo.personas:80}")
    private int personas;

    @Override
    public void run(String... args) {
        try {
            if (applicationRepository.existsByEjemploTrue()) {
                log.info("Datos de demostración del modelo: ya están cargados. No se hace nada.");
                return;
            }
            Set<String> empresasDeEjemplo = new HashSet<>();
            for (Company c : companyRepository.findAll()) {
                if (c.getName() != null && c.getName().toLowerCase().contains("(ejemplo)")) empresasDeEjemplo.add(c.getId());
            }
            List<Job> vacantes = jobRepository.findAll().stream()
                    .filter(j -> empresasDeEjemplo.contains(j.getCompanyId()))
                    .filter(j -> j.getSkills() != null && !j.getSkills().isEmpty()).toList();
            if (vacantes.size() < 5) {
                log.warn("Datos de demostración del modelo: hacen falta al menos 5 vacantes con habilidades de empresas "
                        + "«(ejemplo)» y hay {}. No se carga nada (nunca se postula a vacantes de empresas de verdad).",
                        vacantes.size());
                return;
            }

            Random azar = new Random(42);
            List<User> gente = crearPersonas(vacantes, azar);
            int postulaciones = crearPostulaciones(gente, vacantes, azar);
            log.info("✅ Datos de demostración del modelo: {} personas y {} postulaciones (todas marcadas como ejemplo).",
                    gente.size(), postulaciones);
            // El servidor ya atendia visitas mientras se cargaba: que el modelo aprenda ahora con lo nuevo
            modeloPredictivo.aprender();
        } catch (Exception e) {
            log.error("❌ Error al cargar los datos de demostración del modelo: ", e);
        }
    }

    private List<User> crearPersonas(List<Job> vacantes, Random azar) {
        List<String> pool = new ArrayList<>(vacantes.stream().flatMap(j -> j.getSkills().stream())
                .map(String::trim).filter(h -> !h.isEmpty()).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
        List<User> lista = new ArrayList<>();
        for (int i = 0; i < personas; i++) {
            User u = new User();
            u.setEmail("demo" + i + "@skillmatch.test");
            u.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
            u.setFirstName(NOMBRES[azar.nextInt(NOMBRES.length)]);
            u.setLastName(APELLIDOS[azar.nextInt(APELLIDOS.length)] + " " + APELLIDOS[azar.nextInt(APELLIDOS.length)]);
            u.setPhone(null);
            Job base = vacantes.get(azar.nextInt(vacantes.size()));
            u.setLocation(azar.nextInt(10) < 8 ? base.getLocation() : "Barranquilla");
            u.setHeadline("Persona de demostración");
            u.setRoles(List.of("DEMO"));
            u.setEnabled(false);
            u.setCreatedAt(LocalDateTime.now());
            u.setSkills(habilidades(base, pool, azar));
            u.setExperiences(DemostracionModelo.experiencias(azar));
            u.setEducations(DemostracionModelo.estudios(azar));
            lista.add(u);
        }
        return userRepository.saveAll(lista);
    }

    /** Una parte de lo que pide una vacante (entre 40 % y 100 %) y hasta dos habilidades de otras. */
    private List<Skill> habilidades(Job base, List<String> pool, Random azar) {
        List<String> pedidas = new ArrayList<>(new LinkedHashSet<>(base.getSkills().stream().map(String::trim).toList()));
        java.util.Collections.shuffle(pedidas, azar);
        int cuantas = Math.max(1, (int) Math.round(pedidas.size() * (0.4 + azar.nextDouble() * 0.6)));
        Set<String> elegidas = new LinkedHashSet<>(pedidas.subList(0, Math.min(cuantas, pedidas.size())));
        for (int i = azar.nextInt(3); i > 0; i--) elegidas.add(pool.get(azar.nextInt(pool.size())));
        List<Skill> lista = new ArrayList<>();
        for (String nombre : elegidas) {
            Skill s = new Skill();
            s.setId(ObjectId.get().toString());
            s.setName(nombre);
            s.setLevel(DemostracionModelo.NIVELES[azar.nextInt(DemostracionModelo.NIVELES.length)]);
            lista.add(s);
        }
        return lista;
    }

    private int crearPostulaciones(List<User> gente, List<Job> vacantes, Random azar) {
        List<Application> lista = new ArrayList<>();
        Set<String> vistas = new HashSet<>();
        LocalDateTime ahora = LocalDateTime.now();
        for (User u : gente) {
            int cuantas = 3 + azar.nextInt(3);
            for (int i = 0, intentos = 0; i < cuantas && intentos < 30; intentos++) {
                Job v = DemostracionModelo.elegirVacante(u, vacantes, azar);
                if (!vistas.add(u.getId() + "-" + v.getId())) continue;
                lista.add(DemostracionModelo.postulacion(u, v, azar, ahora));
                i++;
            }
        }
        applicationRepository.saveAll(lista);
        return lista.size();
    }
}
