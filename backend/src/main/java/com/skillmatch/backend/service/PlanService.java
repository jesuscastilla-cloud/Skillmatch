package com.skillmatch.backend.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.ConfiguracionComercial;
import com.skillmatch.backend.model.Invitacion;
import com.skillmatch.backend.model.PlanEmpresa;
import com.skillmatch.backend.model.SolicitudPlan;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.ConfiguracionComercialRepository;
import com.skillmatch.backend.repository.InvitacionCandidatoRepository;
import com.skillmatch.backend.repository.InvitacionRepository;
import com.skillmatch.backend.repository.PlanEmpresaRepository;
import com.skillmatch.backend.repository.SolicitudPlanRepository;
import com.skillmatch.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * El plan de cada empresa, su consumo del mes y la contratacion por activacion manual:
 * la empresa elige plan y pide la activacion; un administrador la aprueba cuando confirma el pago.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlanService {

    static final ZoneId BOGOTA = ZoneId.of("America/Bogota");

    private final PlanEmpresaRepository planes;
    private final SolicitudPlanRepository solicitudes;
    private final ConfiguracionComercialRepository configuraciones;
    private final InvitacionCandidatoRepository invitados;
    private final InvitacionRepository invitaciones;
    private final CompanyRepository companies;
    private final UserRepository users;
    private final NotificationService notificaciones;
    private final MongoTemplate mongoTemplate;
    private final CerrojoService cerrojos;

    // ------------------------------------------------------------------ plan y uso

    /** El plan que rige hoy: el Profesional solo mientras este vigente. */
    public CatalogoPlanes.Plan planVigente(String companyId) {
        return planes.findById(companyId)
                .filter(p -> CatalogoPlanes.PROFESIONAL.equals(p.getPlan()))
                .filter(p -> p.getVigenteHasta() != null && p.getVigenteHasta().isAfter(LocalDateTime.now()))
                .map(p -> CatalogoPlanes.PLAN_PROFESIONAL)
                .orElse(CatalogoPlanes.PLAN_BASICO);
    }

    public static LocalDateTime inicioDelMes() {
        return LocalDate.now(BOGOTA).withDayOfMonth(1).atStartOfDay();
    }

    public long invitacionesDelMes(String companyId) {
        return invitados.countByCompanyIdAndCreatedAtGreaterThanEqual(companyId, inicioDelMes());
    }

    /** Procesos que todavia esperan respuestas o tienen horarios por delante. */
    public long procesosActivos(String companyId) {
        LocalDateTime ahora = LocalDateTime.now();
        return invitaciones.findByCompanyIdAndEstado(companyId, Invitacion.Estado.ACTIVA).stream()
                .filter(i -> (i.getRespondeAntesDe() != null && i.getRespondeAntesDe().isAfter(ahora))
                        || i.getHorarios().stream().anyMatch(h -> h.getInicio() != null && h.getInicio().isAfter(ahora)))
                .count();
    }

    public Company empresaDe(String userId) {
        return companies.findByUserId(userId)
                .orElseThrow(() -> new AccessDeniedException("Esta cuenta no tiene una empresa"));
    }

    /** Lo que ve la empresa en "Plan y uso". */
    public Map<String, Object> resumen(String userId) {
        Company c = empresaDe(userId);
        CatalogoPlanes.Plan plan = planVigente(c.getId());
        PlanEmpresa guardado = planes.findById(c.getId()).orElse(null);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("plan", plan.comoMapa());
        boolean profesional = CatalogoPlanes.PROFESIONAL.equals(plan.id());
        m.put("vigenteHasta", profesional && guardado != null ? guardado.getVigenteHasta() : null);
        // Si el Profesional ya vencio, la pagina lo dice
        m.put("vencidoEl", !profesional && guardado != null && CatalogoPlanes.PROFESIONAL.equals(guardado.getPlan())
                ? guardado.getVigenteHasta() : null);
        Map<String, Object> uso = new LinkedHashMap<>();
        uso.put("invitacionesMes", invitacionesDelMes(c.getId()));
        uso.put("limiteMes", plan.invitacionesMes());
        uso.put("procesosActivos", procesosActivos(c.getId()));
        uso.put("limiteProcesos", plan.procesosActivos());
        uso.put("seRenuevaEl", inicioDelMes().plusMonths(1));
        m.put("uso", uso);
        m.put("solicitudes", solicitudes.findByCompanyIdOrderByCreatedAtDesc(c.getId()).stream().limit(5).map(this::solicitudComoMapa).toList());
        ConfiguracionComercial conf = configuracion();
        boolean pendiente = solicitudes.findFirstByCompanyIdAndEstado(c.getId(), SolicitudPlan.Estado.PENDIENTE).isPresent();
        // Los datos de pago solo se muestran a quien ya pidio la activacion, y solo si estan completos
        m.put("pago", pendiente && conf.transferenciaLista() ? datosDePago(conf) : null);
        m.put("pagoPorTransferencia", conf.transferenciaLista());
        return m;
    }

    // ------------------------------------------------------------------ solicitudes (empresa)

    public SolicitudPlan solicitar(String userId, String plan, Integer meses, String contactoNombre,
                                   String contactoTelefono, String nota) {
        Company c = empresaDe(userId);
        if (!CatalogoPlanes.PROFESIONAL.equals(plan)) throw new IllegalArgumentException("Ese plan no se puede solicitar.");
        int m = meses == null ? 1 : meses;
        if (!CatalogoPlanes.MESES_PERMITIDOS.contains(m)) throw new IllegalArgumentException("Elige 1, 3 o 6 meses.");
        SolicitudPlan guardada = cerrojos.con("plan:" + c.getId(), () -> guardarSolicitud(userId, c, plan, m, contactoNombre, contactoTelefono, nota));
        avisarAdministradores("Nueva solicitud del plan Profesional: " + c.getName(), guardada.getId());
        return guardada;
    }

    private SolicitudPlan guardarSolicitud(String userId, Company c, String plan, int m, String contactoNombre,
                                           String contactoTelefono, String nota) {
        if (solicitudes.findFirstByCompanyIdAndEstado(c.getId(), SolicitudPlan.Estado.PENDIENTE).isPresent()) {
            throw new IllegalArgumentException("Ya tienes una solicitud pendiente de verificación.");
        }
        User u = users.findById(userId).orElseThrow(() -> new ResourceNotFoundException("Cuenta no encontrada"));
        SolicitudPlan s = new SolicitudPlan();
        s.setCompanyId(c.getId());
        s.setCompanyName(c.getName());
        s.setUserId(userId);
        s.setPlan(plan);
        s.setMeses(m);
        s.setValor(CatalogoPlanes.PLAN_PROFESIONAL.precioMensual() * m);
        s.setContactoNombre(contactoNombre == null || contactoNombre.isBlank()
                ? ((u.getFirstName() == null ? "" : u.getFirstName()) + " " + (u.getLastName() == null ? "" : u.getLastName())).trim()
                : contactoNombre.trim());
        s.setContactoCorreo(u.getEmail());
        s.setContactoTelefono(contactoTelefono == null || contactoTelefono.isBlank() ? null : contactoTelefono.trim());
        s.setNota(nota == null || nota.isBlank() ? null : nota.trim());
        s.setEstado(SolicitudPlan.Estado.PENDIENTE);
        s.setCreatedAt(LocalDateTime.now());
        SolicitudPlan guardada = solicitudes.save(s);
        log.info("Solicitud de plan {} ({} meses) de la empresa {}", plan, m, c.getId());
        return guardada;
    }

    public SolicitudPlan cancelarSolicitud(String userId, String solicitudId) {
        Company c = empresaDe(userId);
        return cerrojos.con("plan:" + c.getId(), () -> {
            SolicitudPlan s = solicitudes.findById(solicitudId)
                    .filter(x -> c.getId().equals(x.getCompanyId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Solicitud no encontrada"));
            if (s.getEstado() != SolicitudPlan.Estado.PENDIENTE) throw new IllegalArgumentException("Esta solicitud ya fue atendida.");
            s.setEstado(SolicitudPlan.Estado.CANCELADA);
            s.setAtendidaEn(LocalDateTime.now());
            return solicitudes.save(s);
        });
    }

    // ------------------------------------------------------------------ administracion

    public List<Map<String, Object>> solicitudesParaAdmin(String estado) {
        List<SolicitudPlan> lista = estado == null || estado.isBlank()
                ? solicitudes.findTop50ByOrderByCreatedAtDesc()
                : solicitudes.findByEstadoOrderByCreatedAtAsc(SolicitudPlan.Estado.valueOf(estado.toUpperCase()));
        return lista.stream().map(s -> {
            Map<String, Object> m = solicitudComoMapa(s);
            m.put("companyId", s.getCompanyId());
            m.put("companyName", s.getCompanyName());
            m.put("contactoNombre", s.getContactoNombre());
            m.put("contactoCorreo", s.getContactoCorreo());
            m.put("contactoTelefono", s.getContactoTelefono());
            m.put("nota", s.getNota());
            m.put("planActual", planVigente(s.getCompanyId()).id());
            return m;
        }).toList();
    }

    /** Aprueba: el plan Profesional corre desde hoy (o desde el fin del que ya tenia) por los meses pedidos. */
    public SolicitudPlan aprobar(String adminId, String solicitudId, Integer meses, String nota) {
        String companyId = solicitudes.findById(solicitudId).map(SolicitudPlan::getCompanyId)
                .orElseThrow(() -> new ResourceNotFoundException("Solicitud no encontrada"));
        // El mismo cerrojo de la empresa que usan "solicitar" y "cancelar": una solicitud se atiende una sola vez
        return cerrojos.con("plan:" + companyId, () -> aprobarConCerrojo(adminId, solicitudId, meses, nota));
    }

    private SolicitudPlan aprobarConCerrojo(String adminId, String solicitudId, Integer meses, String nota) {
        SolicitudPlan s = pendiente(solicitudId);
        int m = meses == null ? s.getMeses() : meses;
        if (m < 1 || m > 12) throw new IllegalArgumentException("Los meses deben estar entre 1 y 12.");
        PlanEmpresa p = planes.findById(s.getCompanyId()).orElseGet(() -> new PlanEmpresa(s.getCompanyId()));
        LocalDateTime ahora = LocalDateTime.now();
        LocalDateTime desde = CatalogoPlanes.PROFESIONAL.equals(p.getPlan()) && p.getVigenteHasta() != null && p.getVigenteHasta().isAfter(ahora)
                ? p.getVigenteHasta() : ahora;
        p.setPlan(CatalogoPlanes.PROFESIONAL);
        p.setVigenteHasta(desde.plusMonths(m));
        p.setActivadoEn(ahora);
        p.setActivadoPor(adminId);
        p.setSolicitudId(s.getId());
        planes.save(p);
        s.setEstado(SolicitudPlan.Estado.APROBADA);
        s.setMeses(m);
        s.setNotaAdmin(nota == null || nota.isBlank() ? null : nota.trim());
        s.setAtendidaPor(adminId);
        s.setAtendidaEn(ahora);
        solicitudes.save(s);
        log.info("Plan Profesional activado para la empresa {} hasta {}", s.getCompanyId(), p.getVigenteHasta());
        notificaciones.createNotification(s.getUserId(), "plan",
                "Tu plan Profesional está activo. Ya puedes invitar a más candidatos.", s.getId(), "/pages/planes.html#plan-y-uso");
        return s;
    }

    public SolicitudPlan rechazar(String adminId, String solicitudId, String nota) {
        if (nota == null || nota.isBlank()) throw new IllegalArgumentException("Escribe el motivo para la empresa.");
        String companyId = solicitudes.findById(solicitudId).map(SolicitudPlan::getCompanyId)
                .orElseThrow(() -> new ResourceNotFoundException("Solicitud no encontrada"));
        return cerrojos.con("plan:" + companyId, () -> rechazarConCerrojo(adminId, solicitudId, nota));
    }

    private SolicitudPlan rechazarConCerrojo(String adminId, String solicitudId, String nota) {
        SolicitudPlan s = pendiente(solicitudId);
        s.setEstado(SolicitudPlan.Estado.RECHAZADA);
        s.setNotaAdmin(nota.trim());
        s.setAtendidaPor(adminId);
        s.setAtendidaEn(LocalDateTime.now());
        solicitudes.save(s);
        notificaciones.createNotification(s.getUserId(), "plan",
                "No pudimos activar tu plan: " + nota.trim(), s.getId(), "/pages/planes.html#plan-y-uso");
        return s;
    }

    public List<Map<String, Object>> empresasConPlan() {
        return planes.findByVigenteHastaAfterOrderByVigenteHastaAsc(LocalDateTime.now()).stream()
                .filter(p -> CatalogoPlanes.PROFESIONAL.equals(p.getPlan()))
                .map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("companyId", p.getCompanyId());
                    m.put("companyName", companies.findById(p.getCompanyId()).map(Company::getName).orElse("Empresa"));
                    m.put("vigenteHasta", p.getVigenteHasta());
                    m.put("invitacionesMes", invitacionesDelMes(p.getCompanyId()));
                    return m;
                }).toList();
    }

    public ConfiguracionComercial configuracion() {
        return configuraciones.findById(ConfiguracionComercial.ID).orElseGet(ConfiguracionComercial::new);
    }

    public ConfiguracionComercial guardarConfiguracion(String adminId, ConfiguracionComercial nueva) {
        nueva.setId(ConfiguracionComercial.ID);
        nueva.setActualizado(LocalDateTime.now());
        nueva.setActualizadoPor(adminId);
        return configuraciones.save(nueva);
    }

    // ------------------------------------------------------------------ ayudas

    private SolicitudPlan pendiente(String id) {
        SolicitudPlan s = solicitudes.findById(id).orElseThrow(() -> new ResourceNotFoundException("Solicitud no encontrada"));
        if (s.getEstado() != SolicitudPlan.Estado.PENDIENTE) throw new IllegalArgumentException("Esta solicitud ya fue atendida.");
        return s;
    }

    private Map<String, Object> solicitudComoMapa(SolicitudPlan s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("plan", s.getPlan());
        m.put("meses", s.getMeses());
        m.put("valor", s.getValor());
        m.put("estado", s.getEstado());
        m.put("notaAdmin", s.getNotaAdmin());
        m.put("createdAt", s.getCreatedAt());
        m.put("atendidaEn", s.getAtendidaEn());
        return m;
    }

    private Map<String, Object> datosDePago(ConfiguracionComercial c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("razonSocial", c.getRazonSocial());
        m.put("nit", c.getNit());
        m.put("banco", c.getBanco());
        m.put("tipoCuenta", c.getTipoCuenta());
        m.put("numeroCuenta", c.getNumeroCuenta());
        m.put("titular", c.getTitular());
        m.put("correoPagos", c.getCorreoPagos());
        m.put("telefonoPagos", c.getTelefonoPagos());
        m.put("instrucciones", c.getInstrucciones());
        return m;
    }

    private void avisarAdministradores(String texto, String solicitudId) {
        try {
            mongoTemplate.find(new Query(Criteria.where("roles").is("ADMIN")), User.class)
                    .forEach(a -> notificaciones.createNotification(a.getId(), "plan", texto, solicitudId, "/pages/admin.html"));
        } catch (RuntimeException e) {
            log.warn("No se pudo avisar a los administradores: {}", e.getMessage());
        }
    }
}
