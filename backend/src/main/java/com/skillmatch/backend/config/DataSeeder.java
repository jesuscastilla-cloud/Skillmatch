package com.skillmatch.backend.config;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ApplicationStatus;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.Skill;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.ApplicationRepository;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.JobRepository;
import com.skillmatch.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@Order(2)
@RequiredArgsConstructor
@ConditionalOnProperty(name = "skillmatch.seed.enabled", havingValue = "true", matchIfMissing = false)
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final JobRepository jobRepository;
    private final ApplicationRepository applicationRepository;
    private final PasswordEncoder passwordEncoder;

    private final Random random = new Random();

    /*
     * Cantidades configurables. Los valores por defecto son pequenos a proposito:
     * el seed original creaba 3000 usuarios + 1000 empresas, es decir 4000 hashes
     * BCrypt, lo que tarda varios minutos de CPU y tumbaba el arranque en los
     * planes gratuitos de Railway/Render y el limite de 512 MB de Atlas M0.
     */
    @Value("${skillmatch.seed.users:150}")
    private int seedUsers;

    @Value("${skillmatch.seed.companies:40}")
    private int seedCompanies;

    @Value("${skillmatch.seed.jobs:120}")
    private int seedJobs;

    @Value("${skillmatch.seed.applications:300}")
    private int seedApplications;

    private final String[] firstNames = {
        "Carlos", "María", "Juan", "Ana", "Pedro", "Laura", "Luis", "Carmen", "Jorge", "Isabel",
        "Miguel", "Elena", "Fernando", "Sofía", "Ricardo", "Patricia", "Andrés", "Beatriz", "Diego", "Claudia",
        "Roberto", "Gabriela", "Manuel", "Valentina", "Alberto", "Natalia", "Javier", "Andrea", "Alejandro", "Mariana",
        "Francisco", "Carolina", "Sergio", "Daniela", "Raúl", "Victoria", "Pablo", "Camila", "Oscar", "Lucía",
        "Eduardo", "Mónica", "Arturo", "Paula", "Guillermo", "Sandra", "Héctor", "Diana", "Rodrigo", "Adriana"
    };

    private final String[] lastNames = {
        "García", "Rodríguez", "Martínez", "Hernández", "López", "González", "Pérez", "Sánchez", "Ramírez", "Torres",
        "Flores", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Reyes", "Jiménez", "Ruiz", "Álvarez",
        "Castro", "Ortiz", "Romero", "Mendoza", "Silva", "Vargas", "Herrera", "Medina", "Gutiérrez", "Vega",
        "Ríos", "Ramos", "Castillo", "Domínguez", "Moreno", "Guerrero", "Palacios", "Salazar", "Cortés", "Aguilar"
    };

    private final String[] companyNames = {
        "TechSolutions", "InnovaCode", "DataDrive", "CloudFirst", "DevMasters", "PixelPerfect", "CodeCraft",
        "NextGen Systems", "Digital Dreams", "SmartApps", "WebWizards", "FutureCode", "ByteBuilders", "AppGenius",
        "CyberSoft", "TechVision", "CodeExperts", "InnoTech", "SoftwarePro", "DevHub",
        "Soluciones Digitales", "Tecnología Avanzada", "Sistemas Integrados", "Desarrollo Creativo", "Innovación TI",
        "Consultoría Tech", "Servicios Cloud", "Desarrollo Web", "Aplicaciones Móviles", "Ingeniería Software"
    };

    private final String[] industries = {
        "Tecnología", "Servicios Financieros", "E-commerce", "Educación", "Salud",
        "Retail", "Manufactura", "Logística", "Turismo", "Entretenimiento"
    };

    private final String[] jobTitles = {
        "Desarrollador Full Stack", "Desarrollador Frontend", "Desarrollador Backend", "Ingeniero DevOps",
        "Arquitecto de Software", "Analista de Datos", "Científico de Datos", "Diseñador UX/UI",
        "Product Manager", "Scrum Master", "QA Engineer", "Mobile Developer", "Cloud Engineer",
        "Security Engineer", "Database Administrator", "Business Analyst", "Project Manager",
        "Tech Lead", "Software Engineer", "Machine Learning Engineer"
    };

    private final String[] skillNames = {
        "Java", "Spring Boot", "JavaScript", "React", "Angular", "Vue.js", "Node.js", "Python",
        "Django", "Flask", "PHP", "Laravel", "C#", ".NET", "Ruby", "Rails", "Go", "Kotlin",
        "Swift", "Flutter", "React Native", "Docker", "Kubernetes", "AWS", "Azure", "GCP",
        "MySQL", "PostgreSQL", "MongoDB", "Redis", "Git", "CI/CD", "Agile", "Scrum",
        "REST API", "GraphQL", "Microservices", "TDD", "Design Patterns", "SQL"
    };

    private final String[] levels = {"BÁSICO", "INTERMEDIO", "AVANZADO", "EXPERTO"};

    private final String[] locations = {
        "Cartagena", "Bogotá", "Medellín", "Cali", "Barranquilla", "Bucaramanga",
        "Pereira", "Manizales", "Santa Marta", "Ibagué"
    };

    @Override
    public void run(String... args) {
        try {
            long totalUsers = userRepository.count();
            if (totalUsers > 0) {
                log.info("✓ Base de datos ya tiene {} usuarios. Saltando seed.", totalUsers);
                return;
            }

            log.info("🌱 Iniciando seed de datos...");

            log.info("Creando usuarios regulares...");
            List<User> users = createUsers(seedUsers);

            log.info("Creando empresas...");
            List<Company> companies = createCompanies(seedCompanies);

            log.info("Creando ofertas de trabajo...");
            List<Job> jobs = createJobs(companies, seedJobs);

            log.info("Creando aplicaciones...");
            createApplications(users, jobs, seedApplications);

            log.info("✅ Seed completado exitosamente!");
            log.info("📊 Datos creados: {} usuarios, {} empresas, {} ofertas, {} aplicaciones",
                    seedUsers, seedCompanies, seedJobs, seedApplications);

        } catch (Exception e) {
            log.error("❌ Error durante el seed: ", e);
        }
    }

    private List<User> createUsers(int count) {
        List<User> toSave = new ArrayList<>();
        List<User> allSaved = new ArrayList<>();
        int batchSize = 500;

        for (int i = 0; i < count; i++) {
            User user = new User();
            user.setEmail("usuario" + i + "@skillmatch.com");
            user.setPassword(passwordEncoder.encode("password123"));
            user.setFirstName(firstNames[random.nextInt(firstNames.length)]);
            user.setLastName(lastNames[random.nextInt(lastNames.length)] + " " + lastNames[random.nextInt(lastNames.length)]);
            user.setPhone("+57 3" + String.format("%09d", random.nextInt(1000000000)));
            user.setLocation(locations[random.nextInt(locations.length)]);
            user.setHeadline(jobTitles[random.nextInt(jobTitles.length)]);
            user.setBio("Profesional con experiencia en desarrollo de software y pasión por la tecnología.");
            user.setEnabled(true);
            user.setCreatedAt(LocalDateTime.now().minusDays(random.nextInt(365)));
            user.setRoles(List.of("USER"));
            user.setSkills(generateEmbeddedSkills());

            toSave.add(user);

            if ((i + 1) % batchSize == 0 || i == count - 1) {
                allSaved.addAll(userRepository.saveAll(toSave));
                log.info("   - Usuarios creados: {}/{}", i + 1, count);
                toSave.clear();
            }
        }

        return allSaved;
    }

    private List<Skill> generateEmbeddedSkills() {
        int count = random.nextInt(4) + 2;
        List<Skill> embedded = new ArrayList<>();
        Set<String> chosen = new LinkedHashSet<>();
        while (chosen.size() < count) {
            chosen.add(skillNames[random.nextInt(skillNames.length)]);
        }
        for (String name : chosen) {
            Skill skill = new Skill();
            skill.setId(ObjectId.get().toString());
            skill.setName(name);
            skill.setLevel(levels[random.nextInt(levels.length)]);
            embedded.add(skill);
        }
        return embedded;
    }

    private List<Company> createCompanies(int count) {
        List<User> usersToSave = new ArrayList<>();
        List<Company> allCompanies = new ArrayList<>();
        int batchSize = 50;

        for (int i = 0; i < count; i++) {
            User user = new User();
            user.setEmail("empresa" + i + "@skillmatch.com");
            user.setPassword(passwordEncoder.encode("password123"));
            user.setFirstName(companyNames[random.nextInt(companyNames.length)]);
            user.setLastName("Empresa");
            user.setPhone("+57 3" + String.format("%09d", random.nextInt(1000000000)));
            user.setEnabled(true);
            user.setCreatedAt(LocalDateTime.now().minusDays(random.nextInt(365)));
            user.setRoles(List.of("EMPRESA"));
            usersToSave.add(user);

            if ((i + 1) % batchSize == 0 || i == count - 1) {
                List<User> savedUsers = userRepository.saveAll(usersToSave);

                List<Company> companiesToSave = new ArrayList<>();
                for (User savedUser : savedUsers) {
                    Company company = new Company();
                    company.setUserId(savedUser.getId());
                    company.setName(savedUser.getFirstName());
                    company.setEmail(savedUser.getEmail());
                    company.setPhone(savedUser.getPhone());
                    company.setDescription("Empresa líder en " + industries[random.nextInt(industries.length)] +
                        " con más de " + (random.nextInt(20) + 5) + " años de experiencia en el mercado.");
                    company.setIndustry(industries[random.nextInt(industries.length)]);
                    company.setSize(new String[]{"small", "medium", "large", "enterprise"}[random.nextInt(4)]);
                    company.setLocation(locations[random.nextInt(locations.length)]);
                    company.setWebsite("https://www." + savedUser.getFirstName().toLowerCase().replace(" ", "") + ".com");
                    company.setActive(true);
                    company.setIsVerified(random.nextBoolean());
                    company.setCreatedAt(savedUser.getCreatedAt());
                    companiesToSave.add(company);
                }

                allCompanies.addAll(companyRepository.saveAll(companiesToSave));
                log.info("   - Empresas creadas: {}/{}", i + 1, count);
                usersToSave.clear();
            }
        }

        return allCompanies;
    }

    private List<Job> createJobs(List<Company> companies, int count) {
        List<Job> toSave = new ArrayList<>();
        List<Job> allSaved = new ArrayList<>();
        int batchSize = 50;

        for (int i = 0; i < count; i++) {
            Company company = companies.get(random.nextInt(companies.size()));

            Job job = new Job();
            job.setCompanyId(company.getId());
            job.setTitle(jobTitles[random.nextInt(jobTitles.length)]);
            job.setDescription(generateJobDescription());
            job.setType(new String[]{"empleo", "práctica", "freelance"}[random.nextInt(3)]);
            job.setExperienceLevel(new String[]{"sin-experiencia", "junior", "semi-senior", "senior"}[random.nextInt(4)]);

            double salaryMin = 1000000 + (random.nextInt(4) * 500000);
            job.setSalaryMin(salaryMin);
            job.setSalaryMax(salaryMin + (random.nextInt(3) + 1) * 500000);

            job.setLocation(company.getLocation());
            job.setModality(new String[]{"presencial", "remoto", "híbrido"}[random.nextInt(3)]);
            job.setActive(random.nextInt(10) > 1);
            job.setPostedDate(LocalDateTime.now().minusDays(random.nextInt(90)));

            int skillCount = random.nextInt(5) + 3;
            List<String> jobSkills = new ArrayList<>();
            for (int j = 0; j < skillCount; j++) {
                jobSkills.add(skillNames[random.nextInt(skillNames.length)]);
            }
            job.setSkills(jobSkills);

            job.setRequirements(Arrays.asList(
                "Título universitario en Ingeniería de Sistemas o afín",
                "Experiencia mínima de " + (random.nextInt(3) + 1) + " años",
                "Excelentes habilidades de comunicación"
            ));
            job.setResponsibilities(Arrays.asList(
                "Desarrollar y mantener aplicaciones",
                "Colaborar con el equipo de desarrollo",
                "Participar en reuniones de planificación"
            ));
            job.setBenefits(Arrays.asList(
                "Salario competitivo",
                "Seguro de salud",
                "Días de vacaciones",
                "Capacitación continua"
            ));

            toSave.add(job);

            if ((i + 1) % batchSize == 0 || i == count - 1) {
                allSaved.addAll(jobRepository.saveAll(toSave));
                log.info("   - Ofertas creadas: {}/{}", i + 1, count);
                toSave.clear();
            }
        }

        return allSaved;
    }

    private void createApplications(List<User> users, List<Job> jobs, int count) {
        Set<String> uniqueApplications = new HashSet<>();
        List<Application> toSave = new ArrayList<>();
        int batchSize = 50;

        // Nunca pedir mas combinaciones unicas de las que existen: antes, si
        // count > usuarios*ofertas, el "i--" convertia el bucle en infinito
        // y el arranque se quedaba colgado para siempre.
        long maxPosibles = (long) users.size() * jobs.size();
        if (count > maxPosibles) {
            count = (int) maxPosibles;
        }
        int intentosFallidos = 0;

        for (int i = 0; i < count; i++) {
            User user = users.get(random.nextInt(users.size()));
            Job job = jobs.get(random.nextInt(jobs.size()));

            String key = user.getId() + "-" + job.getId();
            if (uniqueApplications.contains(key)) {
                if (++intentosFallidos > count * 10 + 1000) {
                    log.warn("   - Seed de aplicaciones detenido en {} por falta de combinaciones unicas", i);
                    break;
                }
                i--;
                continue;
            }
            intentosFallidos = 0;

            Application application = new Application();
            application.setUserId(user.getId());
            application.setJobId(job.getId());
            application.setStatus(new ApplicationStatus[]{
                ApplicationStatus.PENDIENTE, ApplicationStatus.REVISADA,
                ApplicationStatus.ACEPTADA, ApplicationStatus.RECHAZADA
            }[random.nextInt(4)]);
            application.setAppliedDate(LocalDateTime.now().minusDays(random.nextInt(60)));
            application.setCoverLetter("Me interesa mucho la posición de " + job.getTitle() +
                " y creo que mi experiencia se alinea perfectamente con los requisitos.");

            toSave.add(application);
            uniqueApplications.add(key);

            if ((i + 1) % batchSize == 0 || i == count - 1) {
                applicationRepository.saveAll(toSave);
                log.info("   - Aplicaciones creadas: {}/{}", i + 1, count);
                toSave.clear();
            }
        }
    }

    private String generateJobDescription() {
        return "Buscamos un profesional talentoso para unirse a nuestro equipo. " +
               "El candidato ideal tendrá experiencia en desarrollo de software, " +
               "trabajará en proyectos innovadores y colaborará con un equipo dinámico. " +
               "Ofrecemos un ambiente de trabajo flexible, oportunidades de crecimiento " +
               "y beneficios competitivos.";
    }
}
