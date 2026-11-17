package com.skillmatch.backend.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import com.skillmatch.backend.dto.InvitacionRequest;
import com.skillmatch.backend.exception.CupoAgotadoException;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ApplicationStatus;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Invitacion;
import com.skillmatch.backend.model.InvitacionCandidato;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.ApplicationRepository;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.InvitacionCandidatoRepository;
import com.skillmatch.backend.repository.InvitacionRepository;
import com.skillmatch.backend.repository.JobRepository;
import com.skillmatch.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Invitaciones a la siguiente etapa: la empresa elige a varias personas que se postularon a una
 * vacante y las invita a una entrevista o evaluacion con horarios; cada una confirma un horario o
 * dice que no puede; la empresa ve las respuestas en un panel. Respeta los cupos del plan.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InvitacionService {

    static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("EEEE d 'de' MMMM, h:mm a", new Locale("es", "CO"));
    private static final Set<InvitacionCandidato.Estado> ABIERTAS = EnumSet.of(InvitacionCandidato.Estado.PENDIENTE, InvitacionCandidato.Estado.CONFIRMADA);

    private final InvitacionRepository invitaciones;
    private final InvitacionCandidatoRepository invitados;
    private final ApplicationRepository applications;
    private final JobRepository jobs;
    private final CompanyRepository companies;
    private final UserRepository users;
    private final PlanService planes;
    private final NotificationService notificaciones;
    private final AvisosCorreoService correos;
    private final CerrojoService cerrojos;

    // ================================================================== empresa

    public Map<String, Object> crear(String userId, InvitacionRequest r) {
        Company c = planes.empresaDe(userId);
        Job job = jobs.findById(r.getJobId()).orElseThrow(() -> new ResourceNotFoundException("Vacante no encontrada"));
        if (!c.getId().equals(job.getCompanyId())) throw new AccessDeniedException("Esa vacante no es de tu empresa");

        // Todo lo que cuenta cupos, procesos y repetidos se revisa y se guarda con el cerrojo de la empresa:
        // dos envios a la vez (dos pestañas, dos personas del equipo) no pueden pasarse del limite del plan.
        Resultado hecho = cerrojos.con("empresa:" + c.getId(), () -> crearConCerrojo(r, c, job, userId));
        hecho.enviados().forEach(ic -> avisarInvitado(ic, hecho.invitacion(), c, false));
        log.info("Invitacion {} de la empresa {} a {} candidatos de la vacante {}", hecho.invitacion().getId(), c.getId(), hecho.enviados().size(), job.getId());
        return detalle(userId, hecho.invitacion().getId());
    }

    private record Resultado(Invitacion invitacion, List<InvitacionCandidato> enviados) { }

    private Resultado crearConCerrojo(InvitacionRequest r, Company c, Job job, String userId) {
        CatalogoPlanes.Plan plan = planes.planVigente(c.getId());
        List<String> ids = r.getApplicationIds().stream().filter(x -> x != null && !x.isBlank()).distinct().toList();
        if (ids.isEmpty()) throw new IllegalArgumentException("Elige al menos un candidato.");
        if (ids.size() > plan.maxPorEnvio()) {
            throw new CupoAgotadoException("Tu plan permite invitar hasta " + plan.maxPorEnvio() + " candidatos en cada envío.");
        }
        long usadas = planes.invitacionesDelMes(c.getId());
        if (usadas + ids.size() > plan.invitacionesMes()) {
            long quedan = Math.max(0, plan.invitacionesMes() - usadas);
            throw new CupoAgotadoException(quedan == 0
                    ? "Ya usaste las " + plan.invitacionesMes() + " invitaciones de este mes."
                    : "Te quedan " + quedan + " invitaciones este mes y elegiste " + ids.size() + ".");
        }
        if (planes.procesosActivos(c.getId()) >= plan.procesosActivos()) {
            throw new CupoAgotadoException("Tu plan permite " + plan.procesosActivos() + " procesos abiertos a la vez. Cierra uno o espera a que termine.");
        }

        // Las postulaciones tienen que ser de esta vacante y seguir en el proceso
        List<Application> apps = applications.findAllById(ids);
        if (apps.size() != ids.size() || apps.stream().anyMatch(a -> !job.getId().equals(a.getJobId()))) {
            throw new IllegalArgumentException("Algunos candidatos no se postularon a esta vacante.");
        }
        if (apps.stream().anyMatch(a -> a.getStatus() == ApplicationStatus.RETIRADA || a.getStatus() == ApplicationStatus.RECHAZADA)) {
            throw new IllegalArgumentException("No puedes invitar a quien retiró su postulación o ya fue rechazado.");
        }
        List<InvitacionCandidato> repetidos = invitados.findByJobIdAndApplicationIdInAndEstadoIn(job.getId(), ids, ABIERTAS).stream()
                .filter(ic -> invitaciones.findById(ic.getInvitacionId()).map(i -> i.getEstado() == Invitacion.Estado.ACTIVA).orElse(false))
                .toList();
        if (!repetidos.isEmpty()) {
            throw new IllegalArgumentException(repetidos.size() == 1
                    ? "Uno de los candidatos ya tiene una invitación abierta para esta vacante."
                    : repetidos.size() + " de los candidatos ya tienen una invitación abierta para esta vacante.");
        }

        Invitacion inv = armar(r, plan, c, job, userId);
        Invitacion guardada = invitaciones.save(inv);
        LocalDateTime ahora = LocalDateTime.now();
        List<InvitacionCandidato> nuevos = apps.stream().map(a -> {
            InvitacionCandidato ic = new InvitacionCandidato();
            ic.setInvitacionId(guardada.getId());
            ic.setApplicationId(a.getId());
            ic.setUserId(a.getUserId());
            ic.setCompanyId(c.getId());
            ic.setJobId(job.getId());
            ic.setEstado(InvitacionCandidato.Estado.PENDIENTE);
            ic.setCreatedAt(ahora);
            return ic;
        }).toList();
        return new Resultado(guardada, invitados.saveAll(nuevos));
    }

    private Invitacion armar(InvitacionRequest r, CatalogoPlanes.Plan plan, Company c, Job job, String userId) {
        Invitacion inv = new Invitacion();
        inv.setCompanyId(c.getId());
        inv.setCompanyUserId(userId);
        inv.setJobId(job.getId());
        inv.setJobTitle(job.getTitle());
        inv.setTipo(Invitacion.Tipo.valueOf(r.getTipo()));
        inv.setModalidad(Invitacion.Modalidad.valueOf(r.getModalidad()));
        if (inv.getModalidad() == Invitacion.Modalidad.PRESENCIAL) {
            if (r.getLugar() == null || r.getLugar().isBlank()) throw new IllegalArgumentException("Escribe la dirección del lugar.");
            inv.setLugar(r.getLugar().trim());
        } else {
            if (r.getEnlace() == null || r.getEnlace().isBlank()) throw new IllegalArgumentException("Pega el enlace de la reunión o de la evaluación.");
            inv.setEnlace(r.getEnlace().trim());
        }
        inv.setIndicaciones(r.getIndicaciones() == null || r.getIndicaciones().isBlank() ? null : r.getIndicaciones().trim());
        inv.setDuracionMinutos(r.getDuracionMinutos() == null ? 30 : r.getDuracionMinutos());

        LocalDateTime ahora = LocalDateTime.now();
        if (r.getHorarios().size() > plan.horariosPorProceso()) {
            throw new CupoAgotadoException("Tu plan permite proponer hasta " + plan.horariosPorProceso() + " horarios por proceso.");
        }
        Set<LocalDateTime> vistos = new HashSet<>();
        List<Invitacion.Horario> horarios = new ArrayList<>();
        for (InvitacionRequest.HorarioRequest h : r.getHorarios()) {
            if (h.getInicio().isBefore(ahora.plusHours(2))) throw new IllegalArgumentException("Los horarios deben ser al menos 2 horas después de ahora.");
            if (h.getInicio().isAfter(ahora.plusDays(60))) throw new IllegalArgumentException("Los horarios deben estar dentro de los próximos 60 días.");
            if (!vistos.add(h.getInicio())) throw new IllegalArgumentException("Hay dos horarios iguales.");
            horarios.add(new Invitacion.Horario(UUID.randomUUID().toString().substring(0, 8), h.getInicio(), h.getCupos()));
        }
        horarios.sort(Comparator.comparing(Invitacion.Horario::getInicio));
        inv.setHorarios(horarios);
        LocalDateTime primero = horarios.get(0).getInicio();
        LocalDateTime limite = r.getRespondeAntesDe() != null ? r.getRespondeAntesDe() : primero.minusHours(2);
        if (limite.isBefore(ahora.plusHours(1))) throw new IllegalArgumentException("Da al menos una hora para responder.");
        if (limite.isAfter(primero)) throw new IllegalArgumentException("La fecha para responder debe ser antes del primer horario.");
        inv.setRespondeAntesDe(limite);
        inv.setEstado(Invitacion.Estado.ACTIVA);
        inv.setCreatedAt(ahora);
        return inv;
    }

    /** Todos los procesos de la empresa, con sus cifras. */
    public List<Map<String, Object>> deLaEmpresa(String userId, String jobId) {
        Company c = planes.empresaDe(userId);
        List<Invitacion> lista = invitaciones.findByCompanyIdOrderByCreatedAtDesc(c.getId()).stream()
                .filter(i -> jobId == null || jobId.isBlank() || jobId.equals(i.getJobId())).toList();
        Map<String, List<InvitacionCandidato>> porProceso = invitados.findByInvitacionIdIn(lista.stream().map(Invitacion::getId).toList())
                .stream().collect(Collectors.groupingBy(InvitacionCandidato::getInvitacionId));
        return lista.stream().map(i -> resumen(i, porProceso.getOrDefault(i.getId(), List.of()))).toList();
    }

    /** Un proceso con cada persona invitada y lo que respondio. */
    public Map<String, Object> detalle(String userId, String invitacionId) {
        Invitacion i = propia(userId, invitacionId);
        List<InvitacionCandidato> lista = invitados.findByInvitacionId(i.getId());
        Map<String, Object> m = resumen(i, lista);
        Map<String, User> personas = users.findAllById(lista.stream().map(InvitacionCandidato::getUserId).toList()).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        m.put("candidatos", lista.stream().map(ic -> {
            User u = personas.get(ic.getUserId());
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("id", ic.getId());
            p.put("applicationId", ic.getApplicationId());
            p.put("userId", ic.getUserId());
            p.put("nombre", u == null ? "Candidato" : ((u.getFirstName() == null ? "" : u.getFirstName()) + " " + (u.getLastName() == null ? "" : u.getLastName())).trim());
            p.put("titular", u == null ? null : u.getHeadline());
            p.put("foto", u == null ? null : u.getProfileImageUrl());
            p.put("estado", estadoReal(ic, i));
            p.put("horarioId", ic.getHorarioId());
            p.put("comentario", ic.getComentario());
            p.put("respondidaEn", ic.getRespondidaEn());
            p.put("recordadaEn", ic.getRecordadaEn());
            return p;
        }).toList());
        return m;
    }

    public Map<String, Object> cancelar(String userId, String invitacionId) {
        propia(userId, invitacionId);
        cerrojos.con("invitacion:" + invitacionId, () -> cancelarConCerrojo(userId, invitacionId));
        return detalle(userId, invitacionId);
    }

    private Boolean cancelarConCerrojo(String userId, String invitacionId) {
        Invitacion i = propia(userId, invitacionId);
        if (i.getEstado() == Invitacion.Estado.CANCELADA) throw new IllegalArgumentException("Este proceso ya estaba cancelado.");
        i.setEstado(Invitacion.Estado.CANCELADA);
        i.setCanceladaEn(LocalDateTime.now());
        invitaciones.save(i);
        Company c = companies.findById(i.getCompanyId()).orElse(null);
        List<InvitacionCandidato> lista = invitados.findByInvitacionId(i.getId());
        lista.stream().filter(ic -> ABIERTAS.contains(ic.getEstado())).forEach(ic -> {
            ic.setEstado(InvitacionCandidato.Estado.CANCELADA);
            invitados.save(ic);
            notificaciones.createNotification(ic.getUserId(), "invitacion",
                    (c == null ? "La empresa" : c.getName()) + " canceló la " + nombreTipo(i) + " para " + i.getJobTitle() + ".",
                    ic.getId(), "/pages/perfil-usuario.html?tab=invitaciones&invitacion=" + ic.getId());
        });
        return Boolean.TRUE;
    }

    /** Recuerda a quienes no han respondido (plan Profesional, una vez cada 24 horas por persona). */
    public Map<String, Object> recordar(String userId, String invitacionId) {
        Invitacion i0 = propia(userId, invitacionId);
        if (!planes.planVigente(i0.getCompanyId()).recordatorios()) {
            throw new CupoAgotadoException("Los recordatorios están en el plan Profesional.");
        }
        int n = cerrojos.con("invitacion:" + invitacionId, () -> recordarConCerrojo(userId, invitacionId));
        Map<String, Object> m = detalle(userId, invitacionId);
        m.put("recordados", n);
        return m;
    }

    private Integer recordarConCerrojo(String userId, String invitacionId) {
        Invitacion i = propia(userId, invitacionId);
        if (i.getEstado() != Invitacion.Estado.ACTIVA || vencida(i)) throw new IllegalArgumentException("Este proceso ya no recibe respuestas.");
        LocalDateTime hace24 = LocalDateTime.now().minusHours(24);
        Company c = companies.findById(i.getCompanyId()).orElse(null);
        int n = 0;
        for (InvitacionCandidato ic : invitados.findByInvitacionId(i.getId())) {
            if (ic.getEstado() != InvitacionCandidato.Estado.PENDIENTE) continue;
            if (ic.getRecordadaEn() != null && ic.getRecordadaEn().isAfter(hace24)) continue;
            ic.setRecordadaEn(LocalDateTime.now());
            invitados.save(ic);
            avisarInvitado(ic, i, c, true);
            n++;
        }
        return n;
    }

    // ================================================================== candidato

    public List<Map<String, Object>> mias(String userId) {
        List<InvitacionCandidato> lista = invitados.findByUserIdOrderByCreatedAtDesc(userId);
        return lista.stream().map(ic -> {
            Invitacion i = invitaciones.findById(ic.getInvitacionId()).orElse(null);
            return i == null ? null : vistaCandidato(ic, i);
        }).filter(java.util.Objects::nonNull).toList();
    }

    public Map<String, Object> responder(String userId, String invitadoId, boolean acepta, String horarioId, String comentario) {
        InvitacionCandidato previo = invitados.findById(invitadoId)
                .filter(x -> userId.equals(x.getUserId()))
                .orElseThrow(() -> new ResourceNotFoundException("Invitación no encontrada"));
        // Un solo cerrojo por proceso: los cupos de cada horario se cuentan y se ocupan sin que nadie se cuele
        return cerrojos.con("invitacion:" + previo.getInvitacionId(), () -> responderConCerrojo(userId, invitadoId, acepta, horarioId, comentario));
    }

    private Map<String, Object> responderConCerrojo(String userId, String invitadoId, boolean acepta, String horarioId, String comentario) {
        InvitacionCandidato ic = invitados.findById(invitadoId)
                .filter(x -> userId.equals(x.getUserId()))
                .orElseThrow(() -> new ResourceNotFoundException("Invitación no encontrada"));
        Invitacion i = invitaciones.findById(ic.getInvitacionId()).orElseThrow(() -> new ResourceNotFoundException("Invitación no encontrada"));
        if (i.getEstado() == Invitacion.Estado.CANCELADA || ic.getEstado() == InvitacionCandidato.Estado.CANCELADA) {
            throw new IllegalArgumentException("La empresa canceló esta invitación.");
        }
        if (vencida(i)) throw new IllegalArgumentException("El plazo para responder ya terminó.");
        if (!ABIERTAS.contains(ic.getEstado()) && ic.getEstado() != InvitacionCandidato.Estado.RECHAZADA) {
            throw new IllegalArgumentException("Esta invitación ya no recibe respuestas.");
        }
        String nota = comentario == null || comentario.isBlank() ? null : comentario.trim();
        if (acepta) {
            Invitacion.Horario h = i.getHorarios().stream().filter(x -> x.getId().equals(horarioId)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Elige uno de los horarios propuestos."));
            if (h.getInicio().isBefore(LocalDateTime.now())) throw new IllegalArgumentException("Ese horario ya pasó.");
            long ocupados = invitados.countByInvitacionIdAndHorarioIdAndEstado(i.getId(), h.getId(), InvitacionCandidato.Estado.CONFIRMADA);
            boolean yaEsMio = ic.getEstado() == InvitacionCandidato.Estado.CONFIRMADA && h.getId().equals(ic.getHorarioId());
            if (!yaEsMio && h.getCupos() != null && ocupados >= h.getCupos()) {
                throw new IllegalArgumentException("Ese horario ya se llenó. Elige otro.");
            }
            ic.setEstado(InvitacionCandidato.Estado.CONFIRMADA);
            ic.setHorarioId(h.getId());
        } else {
            ic.setEstado(InvitacionCandidato.Estado.RECHAZADA);
            ic.setHorarioId(null);
        }
        ic.setComentario(nota);
        ic.setRespondidaEn(LocalDateTime.now());
        invitados.save(ic);

        User u = users.findById(userId).orElse(null);
        String quien = u == null || u.getFirstName() == null ? "Un candidato" : u.getFirstName().trim();
        String texto = acepta
                ? quien + " confirmó para el " + FECHA.format(horarioDe(i, ic.getHorarioId())) + " (" + i.getJobTitle() + ")"
                : quien + " no puede asistir a la " + nombreTipo(i) + " de " + i.getJobTitle();
        notificaciones.createNotification(i.getCompanyUserId(), "invitacion_respuesta", texto, i.getId(),
                "/pages/perfil-empresa.html?invitacion=" + i.getId());
        return vistaCandidato(ic, i);
    }

    // ================================================================== vencimientos

    /** Cada hora: las invitaciones sin respuesta cuyo plazo paso quedan como vencidas. */
    @Scheduled(cron = "${skillmatch.invitaciones.cron:0 5 * * * *}", zone = "America/Bogota")
    public void marcarVencidas() {
        LocalDateTime ahora = LocalDateTime.now();
        int n = 0;
        for (InvitacionCandidato ic : invitados.findByEstadoAndCreatedAtBefore(InvitacionCandidato.Estado.PENDIENTE, ahora)) {
            Invitacion i = invitaciones.findById(ic.getInvitacionId()).orElse(null);
            if (i != null && vencida(i)) {
                boolean marcada = cerrojos.con("invitacion:" + i.getId(), () -> {
                    // Se vuelve a leer: si la persona alcanzo a responder, no se pisa su respuesta
                    InvitacionCandidato actual = invitados.findById(ic.getId()).orElse(null);
                    if (actual == null || actual.getEstado() != InvitacionCandidato.Estado.PENDIENTE) return false;
                    actual.setEstado(InvitacionCandidato.Estado.VENCIDA);
                    invitados.save(actual);
                    return true;
                });
                if (marcada) n++;
            }
        }
        if (n > 0) log.info("Invitaciones vencidas sin respuesta: {}", n);
    }

    // ================================================================== ayudas

    private Invitacion propia(String userId, String invitacionId) {
        Company c = planes.empresaDe(userId);
        return invitaciones.findById(invitacionId)
                .filter(i -> c.getId().equals(i.getCompanyId()))
                .orElseThrow(() -> new ResourceNotFoundException("Proceso no encontrado"));
    }

    static boolean vencida(Invitacion i) {
        return i.getRespondeAntesDe() != null && i.getRespondeAntesDe().isBefore(LocalDateTime.now());
    }

    /** Una pendiente cuyo plazo paso se muestra como vencida aunque la tarea horaria no haya corrido. */
    static InvitacionCandidato.Estado estadoReal(InvitacionCandidato ic, Invitacion i) {
        if (ic.getEstado() == InvitacionCandidato.Estado.PENDIENTE && vencida(i)) return InvitacionCandidato.Estado.VENCIDA;
        return ic.getEstado();
    }

    private Map<String, Object> resumen(Invitacion i, List<InvitacionCandidato> lista) {
        Map<String, Object> m = base(i);
        Map<String, Long> cuentas = new LinkedHashMap<>();
        for (InvitacionCandidato.Estado e : InvitacionCandidato.Estado.values()) cuentas.put(e.name().toLowerCase(), 0L);
        lista.forEach(ic -> cuentas.merge(estadoReal(ic, i).name().toLowerCase(), 1L, Long::sum));
        m.put("cuentas", cuentas);
        m.put("total", lista.size());
        m.put("horarios", i.getHorarios().stream().map(h -> {
            Map<String, Object> x = new LinkedHashMap<>();
            x.put("id", h.getId());
            x.put("inicio", h.getInicio());
            x.put("cupos", h.getCupos());
            x.put("confirmados", lista.stream().filter(ic -> ic.getEstado() == InvitacionCandidato.Estado.CONFIRMADA && h.getId().equals(ic.getHorarioId())).count());
            return x;
        }).toList());
        m.put("vencida", vencida(i));
        m.put("recordatorios", planes.planVigente(i.getCompanyId()).recordatorios());
        m.put("exportarRespuestas", planes.planVigente(i.getCompanyId()).exportarRespuestas());
        return m;
    }

    private Map<String, Object> base(Invitacion i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.getId());
        m.put("jobId", i.getJobId());
        m.put("jobTitle", i.getJobTitle());
        m.put("tipo", i.getTipo());
        m.put("modalidad", i.getModalidad());
        m.put("lugar", i.getLugar());
        m.put("enlace", i.getEnlace());
        m.put("indicaciones", i.getIndicaciones());
        m.put("duracionMinutos", i.getDuracionMinutos());
        m.put("respondeAntesDe", i.getRespondeAntesDe());
        m.put("estado", i.getEstado());
        m.put("createdAt", i.getCreatedAt());
        return m;
    }

    private Map<String, Object> vistaCandidato(InvitacionCandidato ic, Invitacion i) {
        Map<String, Object> m = base(i);
        m.put("invitacionId", i.getId());
        m.put("id", ic.getId());
        m.put("applicationId", ic.getApplicationId());
        m.put("empresa", companies.findById(i.getCompanyId()).map(Company::getName).orElse("La empresa"));
        m.put("companyId", i.getCompanyId());
        m.put("miEstado", estadoReal(ic, i));
        m.put("horarioId", ic.getHorarioId());
        m.put("comentario", ic.getComentario());
        m.put("respondidaEn", ic.getRespondidaEn());
        boolean abierta = i.getEstado() == Invitacion.Estado.ACTIVA && !vencida(i);
        m.put("puedeResponder", abierta && ic.getEstado() != InvitacionCandidato.Estado.CANCELADA);
        m.put("horarios", i.getHorarios().stream().map(h -> {
            long ocupados = invitados.countByInvitacionIdAndHorarioIdAndEstado(i.getId(), h.getId(), InvitacionCandidato.Estado.CONFIRMADA);
            boolean mio = h.getId().equals(ic.getHorarioId()) && ic.getEstado() == InvitacionCandidato.Estado.CONFIRMADA;
            Map<String, Object> x = new LinkedHashMap<>();
            x.put("id", h.getId());
            x.put("inicio", h.getInicio());
            x.put("disponible", mio || ((h.getCupos() == null || ocupados < h.getCupos()) && h.getInicio().isAfter(LocalDateTime.now())));
            return x;
        }).toList());
        // La direccion y las indicaciones se ven desde el principio: la persona las necesita para decidir si
        // puede ir. Solo el enlace privado de una reunion o evaluacion virtual espera a que confirme.
        if (ic.getEstado() != InvitacionCandidato.Estado.CONFIRMADA) m.put("enlace", null);
        m.put("ciudad", i.getModalidad() == Invitacion.Modalidad.PRESENCIAL ? "Presencial" : "Virtual");
        return m;
    }

    private LocalDateTime horarioDe(Invitacion i, String horarioId) {
        return i.getHorarios().stream().filter(h -> h.getId().equals(horarioId)).map(Invitacion.Horario::getInicio).findFirst().orElse(LocalDateTime.now());
    }

    private static String nombreTipo(Invitacion i) {
        return i.getTipo() == Invitacion.Tipo.EVALUACION ? "evaluación" : "entrevista";
    }

    private void avisarInvitado(InvitacionCandidato ic, Invitacion i, Company c, boolean recordatorio) {
        String empresa = c == null ? "Una empresa" : c.getName();
        String enlace = "/pages/perfil-usuario.html?tab=invitaciones&invitacion=" + ic.getId();
        notificaciones.createNotification(ic.getUserId(), "invitacion",
                (recordatorio ? "Recuerda responder: " : "") + empresa + " te invita a una " + nombreTipo(i) + " para " + i.getJobTitle(),
                ic.getId(), enlace);
        try {
            users.findById(ic.getUserId()).ifPresent(u -> correos.invitacion(u, empresa, i, enlace, recordatorio));
        } catch (RuntimeException e) {
            log.warn("No se pudo enviar el correo de la invitacion {}: {}", ic.getId(), e.getMessage());
        }
    }
}
