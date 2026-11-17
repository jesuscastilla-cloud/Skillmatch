package com.skillmatch.backend.config;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ApplicationStatus;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Connection;
import com.skillmatch.backend.model.ConnectionStatus;
import com.skillmatch.backend.model.Invitacion;
import com.skillmatch.backend.model.InvitacionCandidato;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.JobStatus;
import com.skillmatch.backend.model.Message;
import com.skillmatch.backend.model.Notification;
import com.skillmatch.backend.model.PlanEmpresa;
import com.skillmatch.backend.model.SavedJob;
import com.skillmatch.backend.model.SolicitudPlan;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.service.CatalogoPlanes;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Un escenario pequeno y completo para probar todo SkillMatch con las cuentas de siempre
 * (usuario0@skillmatch.com y empresa0@skillmatch.com, clave password123). Lo arma el sembrado
 * (DataSeeder) despues de las personas, empresas, vacantes y postulaciones al azar:
 *
 *  - empresa0: dos vacantes abiertas (una con 7 postulaciones) y una cerrada; un proceso de
 *    invitacion abierto (una persona confirmo, otra no puede, dos sin responder) y otro ya vencido.
 *    Sigue en el plan Basico, para probar los limites y la contratacion.
 *  - usuario0: una invitacion por responder, una postulacion a una vacante que ya cerro, una
 *    conexion, una solicitud de conexion por aceptar, mensajes sin leer y vacantes guardadas.
 *  - empresa1: plan Profesional activo (para probar recordatorios y Excel).
 *  - empresa2: una solicitud de plan pendiente (para la administracion).
 *  - admin@skillmatch.com (USER y ADMIN): SOLO si se define SEED_ADMIN_PASSWORD. Asi, sembrar una base
 *    de produccion nunca deja una cuenta de administracion con una clave que todos conocen.
 *
 * Pocos datos, cada uno con un proposito. Todas las postulaciones quedan marcadas como de ejemplo.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EscenarioDePrueba {

    static final String CORREO_ADMIN = "admin@skillmatch.com";

    private final MongoTemplate mongo;
    private final PasswordEncoder passwordEncoder;

    @Value("${skillmatch.seed.admin-password:${SEED_ADMIN_PASSWORD:}}")
    private String claveAdmin;

    public void crear() {
        LocalDateTime ahora = LocalDateTime.now();
        User persona = usuario("usuario0@skillmatch.com");
        User cuentaEmpresa = usuario("empresa0@skillmatch.com");
        Company empresa = cuentaEmpresa == null ? null : empresaDe(cuentaEmpresa);
        List<User> otros = new ArrayList<>();
        for (int i = 1; i <= 7; i++) {
            User u = usuario("usuario" + i + "@skillmatch.com");
            if (u != null) otros.add(u);
        }
        if (persona == null || empresa == null || otros.size() < 6) {
            log.warn("Escenario de prueba: faltan cuentas del sembrado (usuario0..7, empresa0); no se crea");
            return;
        }

        // ---- 1. Vacantes de empresa0: dos abiertas y una que ya cerro
        List<String> suyas = habilidadesDe(persona);
        Job recepcion = vacante(empresa, "Recepcionista bilingüe", "empleo", "junior", suyas, ahora.minusDays(12), true);
        Job auxiliar = vacante(empresa, "Auxiliar administrativo", "empleo", "sin-experiencia", suyas.subList(0, Math.min(2, suyas.size())), ahora.minusDays(16), true);
        Job cerrada = vacante(empresa, "Asistente de ventas", "práctica", "sin-experiencia", suyas, ahora.minusDays(75), false);

        // ---- 2. Postulaciones (pendientes o revisadas: no cambian lo que aprende el modelo)
        Application dePersona = postular(persona, recepcion, ahora.minusDays(10), ApplicationStatus.PENDIENTE);
        List<Application> recibidas = new ArrayList<>(List.of(dePersona));
        for (int i = 0; i < 6; i++) {
            recibidas.add(postular(otros.get(i), recepcion, ahora.minusDays(9 - i), i % 2 == 0 ? ApplicationStatus.REVISADA : ApplicationStatus.PENDIENTE));
        }
        postular(persona, cerrada, ahora.minusDays(60), ApplicationStatus.PENDIENTE);
        Application aux1 = postular(otros.get(4), auxiliar, ahora.minusDays(14), ApplicationStatus.REVISADA);
        Application aux2 = postular(otros.get(5), auxiliar, ahora.minusDays(13), ApplicationStatus.PENDIENTE);

        // ---- 3. Invitaciones: un proceso abierto y otro ya vencido
        Invitacion abierto = new Invitacion();
        abierto.setCompanyId(empresa.getId());
        abierto.setCompanyUserId(cuentaEmpresa.getId());
        abierto.setJobId(recepcion.getId());
        abierto.setJobTitle(recepcion.getTitle());
        abierto.setTipo(Invitacion.Tipo.ENTREVISTA);
        abierto.setModalidad(Invitacion.Modalidad.PRESENCIAL);
        abierto.setLugar("Cra. 3 # 8-129, Bocagrande, piso 2");
        abierto.setIndicaciones("Trae tu documento de identidad y pregunta por Recursos Humanos en la recepción.");
        abierto.setDuracionMinutos(30);
        LocalDateTime dia = ahora.plusDays(3).withHour(9).withMinute(0).withSecond(0).withNano(0);
        abierto.setHorarios(List.of(
                new Invitacion.Horario(id(), dia, 2),
                new Invitacion.Horario(id(), dia.withHour(10), 2),
                new Invitacion.Horario(id(), dia.plusDays(1).withHour(15), 1)));
        abierto.setRespondeAntesDe(ahora.plusDays(2).withHour(18).withMinute(0).withSecond(0).withNano(0));
        abierto.setEstado(Invitacion.Estado.ACTIVA);
        abierto.setCreatedAt(ahora.minusDays(1));
        abierto = mongo.save(abierto);
        String h1 = abierto.getHorarios().get(0).getId();
        InvitacionCandidato invitacionDePersona = invitado(abierto, dePersona, InvitacionCandidato.Estado.PENDIENTE, null, null, null);
        invitado(abierto, recibidas.get(1), InvitacionCandidato.Estado.CONFIRMADA, h1, "Llevo mi hoja de vida impresa.", ahora.minusHours(20));
        invitado(abierto, recibidas.get(2), InvitacionCandidato.Estado.RECHAZADA, null, "Esa semana estoy fuera de la ciudad. Gracias por la invitación.", ahora.minusHours(18));
        invitado(abierto, recibidas.get(3), InvitacionCandidato.Estado.PENDIENTE, null, null, null);

        Invitacion vencido = new Invitacion();
        vencido.setCompanyId(empresa.getId());
        vencido.setCompanyUserId(cuentaEmpresa.getId());
        vencido.setJobId(auxiliar.getId());
        vencido.setJobTitle(auxiliar.getTitle());
        vencido.setTipo(Invitacion.Tipo.EVALUACION);
        vencido.setModalidad(Invitacion.Modalidad.VIRTUAL);
        vencido.setEnlace("https://meet.jit.si/skillmatch-evaluacion-auxiliar");
        vencido.setDuracionMinutos(45);
        LocalDateTime pasado = ahora.minusDays(5).withHour(10).withMinute(0).withSecond(0).withNano(0);
        vencido.setHorarios(List.of(new Invitacion.Horario(id(), pasado, 3)));
        vencido.setRespondeAntesDe(pasado.minusDays(1));
        vencido.setEstado(Invitacion.Estado.ACTIVA);
        vencido.setCreatedAt(ahora.minusDays(9));
        vencido = mongo.save(vencido);
        invitado(vencido, aux1, InvitacionCandidato.Estado.CONFIRMADA, vencido.getHorarios().get(0).getId(), null, ahora.minusDays(8));
        invitado(vencido, aux2, InvitacionCandidato.Estado.VENCIDA, null, null, null);

        aviso(persona.getId(), "invitacion", empresa.getName() + " te invita a una entrevista para " + recepcion.getTitle(),
                invitacionDePersona.getId(), "/pages/perfil-usuario.html?tab=invitaciones&invitacion=" + invitacionDePersona.getId(), ahora.minusDays(1));
        aviso(cuentaEmpresa.getId(), "invitacion_respuesta", nombre(otros.get(0)) + " confirmó su asistencia (" + recepcion.getTitle() + ")",
                abierto.getId(), "/pages/perfil-empresa.html?invitacion=" + abierto.getId(), ahora.minusHours(20));

        // ---- 4. Planes: empresa1 con el Profesional activo; empresa2 con una solicitud por revisar
        User cuenta1 = usuario("empresa1@skillmatch.com"), cuenta2 = usuario("empresa2@skillmatch.com");
        Company empresa1 = cuenta1 == null ? null : empresaDe(cuenta1), empresa2 = cuenta2 == null ? null : empresaDe(cuenta2);
        if (empresa1 != null) {
            SolicitudPlan aprobada = solicitud(empresa1, cuenta1, 1, SolicitudPlan.Estado.APROBADA, null, ahora.minusDays(11));
            aprobada.setAtendidaEn(ahora.minusDays(10));
            aprobada.setNotaAdmin("Pago verificado.");
            aprobada = mongo.save(aprobada);
            PlanEmpresa plan = new PlanEmpresa(empresa1.getId());
            plan.setPlan(CatalogoPlanes.PROFESIONAL);
            plan.setActivadoEn(ahora.minusDays(10));
            plan.setVigenteHasta(ahora.minusDays(10).plusMonths(1));
            plan.setActivadoPor("sembrado");
            plan.setSolicitudId(aprobada.getId());
            mongo.save(plan);
        }
        if (empresa2 != null) {
            solicitud(empresa2, cuenta2, 3, SolicitudPlan.Estado.PENDIENTE, "Necesitamos la factura a nombre de la empresa.", ahora.minusDays(1));
        }

        // ---- 5. La red de usuario0: una conexion, una solicitud por aceptar, mensajes y vacantes guardadas
        User amiga = otros.get(0), quienPide = otros.get(1);
        conexion(persona, amiga, ConnectionStatus.ACCEPTED, ahora.minusDays(20));
        Connection pedida = conexion(quienPide, persona, ConnectionStatus.PENDING, ahora.minusDays(2));
        aviso(persona.getId(), "connection_request", nombre(quienPide) + " quiere conectar contigo", pedida.getId(), "/pages/conexiones.html?tab=pending", ahora.minusDays(2));
        mensaje(cuentaEmpresa, persona, "Hola, vimos tu postulación a " + recepcion.getTitle() + ". ¿Tienes disponibilidad esta semana?", ahora.minusDays(3), true);
        mensaje(persona, cuentaEmpresa, "¡Hola! Sí, tengo disponibilidad en las mañanas.", ahora.minusDays(3).plusHours(2), true);
        Message ultimo = mensaje(cuentaEmpresa, persona, "Perfecto. Te enviamos la invitación con los horarios por SkillMatch.", ahora.minusHours(26), false);
        aviso(persona.getId(), "message", empresa.getName() + " te envió un mensaje", ultimo.getId(), "/pages/mensajes.html?userId=" + cuentaEmpresa.getId(), ahora.minusHours(26));
        mensaje(amiga, persona, "¿Viste la vacante de " + auxiliar.getTitle() + "? Creo que te sirve.", ahora.minusHours(5), false);
        guardar(persona, auxiliar, ahora.minusDays(6));
        guardar(persona, recepcion, ahora.minusDays(11));

        // ---- 6. Administracion (solo con SEED_ADMIN_PASSWORD)
        User admin = null;
        if (claveAdmin != null && !claveAdmin.isBlank() && usuario(CORREO_ADMIN) == null) {
            admin = new User();
            admin.setEmail(CORREO_ADMIN);
            admin.setPassword(passwordEncoder.encode(claveAdmin));
            admin.setFirstName("Administración");
            admin.setLastName("SkillMatch");
            admin.setEnabled(true);
            admin.setCreatedAt(ahora.minusDays(30));
            admin.setRoles(List.of("USER", "ADMIN"));
            admin = mongo.save(admin);
            if (empresa2 != null) {
                aviso(admin.getId(), "plan", "Nueva solicitud del plan Profesional: " + empresa2.getName(), null, "/pages/admin.html", ahora.minusDays(1));
            }
        }

        log.info("Escenario de prueba listo: usuario0 y empresa0 (clave password123), empresa1 con plan Profesional, "
                + "empresa2 con una solicitud pendiente{}", admin != null ? ", y " + CORREO_ADMIN + " (clave de SEED_ADMIN_PASSWORD)"
                : ". Sin cuenta de administración: define SEED_ADMIN_PASSWORD para crearla");
    }

    // ------------------------------------------------------------------ ayudas

    private User usuario(String correo) {
        return mongo.findOne(Query.query(Criteria.where("email").is(correo)), User.class);
    }

    private Company empresaDe(User cuenta) {
        return mongo.findOne(Query.query(Criteria.where("userId").is(cuenta.getId())), Company.class);
    }

    private static String id() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private static String nombre(User u) {
        return u.getFirstName() == null ? "Alguien" : u.getFirstName().trim();
    }

    /** Las habilidades de la persona (asi su porcentaje de match con estas vacantes sale alto). */
    private static List<String> habilidadesDe(User u) {
        List<String> l = new ArrayList<>();
        if (u.getSkills() != null) u.getSkills().forEach(s -> { if (s.getName() != null && l.size() < 4) l.add(s.getName()); });
        if (l.isEmpty()) l.addAll(List.of("Atención al cliente", "Inglés", "Excel"));
        return l;
    }

    private Job vacante(Company c, String titulo, String tipo, String nivel, List<String> habilidades, LocalDateTime publicada, boolean abierta) {
        Job j = new Job();
        j.setCompanyId(c.getId());
        j.setTitle(titulo);
        j.setDescription("Buscamos una persona responsable y con buena actitud de servicio para unirse a nuestro equipo en " + c.getName() + ".");
        j.setType(tipo);
        j.setExperienceLevel(nivel);
        j.setSalaryMin(1_600_000.0);
        j.setSalaryMax(2_200_000.0);
        j.setLocation(c.getLocation() == null ? "Cartagena" : c.getLocation());
        j.setModality("presencial");
        j.setSkills(new ArrayList<>(habilidades));
        j.setRequirements(List.of("Bachiller o técnico", "Buena comunicación"));
        j.setResponsibilities(List.of("Atender a los clientes", "Apoyar al equipo en el día a día"));
        j.setBenefits(List.of("Contrato a término indefinido", "Capacitación"));
        j.setPostedDate(publicada);
        j.setCreatedAt(publicada);
        j.setUpdatedAt(abierta ? publicada : publicada.plusDays(30));
        j.setActive(abierta);
        j.setStatus(abierta ? JobStatus.ABIERTA : JobStatus.CERRADA);
        return mongo.save(j);
    }

    private Application postular(User u, Job j, LocalDateTime cuando, ApplicationStatus estado) {
        Application existente = mongo.findOne(Query.query(Criteria.where("userId").is(u.getId()).and("jobId").is(j.getId())), Application.class);
        if (existente != null) return existente;
        Application a = new Application();
        a.setUserId(u.getId());
        a.setJobId(j.getId());
        a.setStatus(estado);
        a.setCoverLetter("Me interesa esta vacante porque tengo experiencia atendiendo clientes y me gusta aprender.");
        a.setAppliedDate(cuando);
        a.setCreatedAt(cuando);
        a.setUpdatedAt(estado == ApplicationStatus.PENDIENTE ? cuando : cuando.plusDays(1));
        a.setEjemplo(true);
        return mongo.save(a);
    }

    private InvitacionCandidato invitado(Invitacion i, Application a, InvitacionCandidato.Estado estado, String horarioId,
                                         String comentario, LocalDateTime respondida) {
        InvitacionCandidato ic = new InvitacionCandidato();
        ic.setInvitacionId(i.getId());
        ic.setApplicationId(a.getId());
        ic.setUserId(a.getUserId());
        ic.setCompanyId(i.getCompanyId());
        ic.setJobId(i.getJobId());
        ic.setEstado(estado);
        ic.setHorarioId(horarioId);
        ic.setComentario(comentario);
        ic.setRespondidaEn(respondida);
        ic.setCreatedAt(i.getCreatedAt());
        return mongo.save(ic);
    }

    private SolicitudPlan solicitud(Company c, User cuenta, int meses, SolicitudPlan.Estado estado, String nota, LocalDateTime cuando) {
        SolicitudPlan s = new SolicitudPlan();
        s.setCompanyId(c.getId());
        s.setCompanyName(c.getName());
        s.setUserId(cuenta.getId());
        s.setPlan(CatalogoPlanes.PROFESIONAL);
        s.setMeses(meses);
        s.setValor(CatalogoPlanes.PLAN_PROFESIONAL.precioMensual() * meses);
        s.setContactoNombre("Laura Gómez");
        s.setContactoCorreo(cuenta.getEmail());
        s.setContactoTelefono("300 000 0000");
        s.setNota(nota);
        s.setEstado(estado);
        s.setCreatedAt(cuando);
        return mongo.save(s);
    }

    private Connection conexion(User de, User para, ConnectionStatus estado, LocalDateTime cuando) {
        Connection c = new Connection();
        c.setUserId(de.getId());
        c.setConnectedUserId(para.getId());
        c.setStatus(estado);
        c.setRequestedAt(cuando);
        c.setRespondedAt(estado == ConnectionStatus.PENDING ? null : cuando.plusHours(3));
        c.setMessage(estado == ConnectionStatus.PENDING ? "Hola, vi tu perfil y me gustaría conectar." : null);
        c.setCreatedAt(cuando);
        c.setUpdatedAt(cuando);
        return mongo.save(c);
    }

    private Message mensaje(User de, User para, String texto, LocalDateTime cuando, boolean leido) {
        Message m = new Message();
        m.setSenderId(de.getId());
        m.setReceiverId(para.getId());
        m.setContent(texto);
        m.setSentAt(cuando);
        m.setIsRead(leido);
        m.setReadAt(leido ? cuando.plusMinutes(30) : null);
        return mongo.save(m);
    }

    private void guardar(User u, Job j, LocalDateTime cuando) {
        SavedJob s = new SavedJob();
        s.setUserId(u.getId());
        s.setJobId(j.getId());
        s.setSavedAt(cuando);
        mongo.save(s);
    }

    private void aviso(String userId, String tipo, String texto, String relacionado, String enlace, LocalDateTime cuando) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(tipo);
        n.setContent(texto);
        n.setRelatedId(relacionado);
        n.setActionUrl(enlace);
        n.setCreatedAt(cuando);
        mongo.save(n);
    }
}
