package com.skillmatch.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;

import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.ConfiguracionComercial;
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

/** Planes: vigencia, solicitudes de activacion y lo que hace el administrador. */
class PlanServiceTest {

    private final PlanEmpresaRepository planes = mock(PlanEmpresaRepository.class);
    private final SolicitudPlanRepository solicitudes = mock(SolicitudPlanRepository.class);
    private final ConfiguracionComercialRepository configuraciones = mock(ConfiguracionComercialRepository.class);
    private final InvitacionCandidatoRepository invitados = mock(InvitacionCandidatoRepository.class);
    private final InvitacionRepository invitaciones = mock(InvitacionRepository.class);
    private final CompanyRepository companies = mock(CompanyRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final NotificationService notificaciones = mock(NotificationService.class);
    private final MongoTemplate mongo = mock(MongoTemplate.class);
    private final PlanService servicio = new PlanService(planes, solicitudes, configuraciones, invitados, invitaciones, companies, users, notificaciones, mongo);

    private PlanEmpresa guardado;

    @BeforeEach
    void preparar() {
        Company c = new Company(); c.setId("c-1"); c.setUserId("u-empresa"); c.setName("Hotel Bahía");
        when(companies.findByUserId("u-empresa")).thenReturn(Optional.of(c));
        User u = new User(); u.setId("u-empresa"); u.setFirstName("Ana"); u.setLastName("Pérez"); u.setEmail("ana@hotel.test");
        when(users.findById("u-empresa")).thenReturn(Optional.of(u));
        when(solicitudes.save(any())).thenAnswer(i -> { SolicitudPlan s = i.getArgument(0); if (s.getId() == null) s.setId("s-1"); return s; });
        when(planes.save(any())).thenAnswer(i -> { guardado = i.getArgument(0); return guardado; });
        when(configuraciones.findById(ConfiguracionComercial.ID)).thenReturn(Optional.empty());
        when(invitaciones.findByCompanyIdAndEstado(anyString(), any())).thenReturn(List.of());
    }

    private PlanEmpresa profesionalHasta(LocalDateTime fecha) {
        PlanEmpresa p = new PlanEmpresa("c-1"); p.setPlan(CatalogoPlanes.PROFESIONAL); p.setVigenteHasta(fecha);
        return p;
    }

    @Test
    void sinPlanGuardado_esBasico_yElProfesionalVencidoVuelveABasico() {
        when(planes.findById("c-1")).thenReturn(Optional.empty());
        assertThat(servicio.planVigente("c-1").id()).isEqualTo(CatalogoPlanes.BASICO);
        when(planes.findById("c-1")).thenReturn(Optional.of(profesionalHasta(LocalDateTime.now().plusDays(5))));
        assertThat(servicio.planVigente("c-1").id()).isEqualTo(CatalogoPlanes.PROFESIONAL);
        when(planes.findById("c-1")).thenReturn(Optional.of(profesionalHasta(LocalDateTime.now().minusMinutes(1))));
        assertThat(servicio.planVigente("c-1").id()).isEqualTo(CatalogoPlanes.BASICO);
    }

    @Test
    void ningunPlanEsIlimitado() {
        CatalogoPlanes.TODOS.forEach(p -> {
            assertThat(p.invitacionesMes()).isPositive().isLessThanOrEqualTo(300);
            assertThat(p.maxPorEnvio()).isPositive().isLessThanOrEqualTo(p.invitacionesMes());
        });
        assertThat(CatalogoPlanes.PLAN_PROFESIONAL.precioMensual()).isEqualTo(49_900);
    }

    @Test
    void solicitarActivacion_guardaElValor_yAvisaALosAdministradores() {
        User admin = new User(); admin.setId("admin-1");
        when(mongo.find(any(), eq(User.class))).thenReturn(List.of(admin));
        SolicitudPlan s = servicio.solicitar("u-empresa", CatalogoPlanes.PROFESIONAL, 3, null, "300 123 4567", null);
        assertThat(s.getEstado()).isEqualTo(SolicitudPlan.Estado.PENDIENTE);
        assertThat(s.getValor()).isEqualTo(149_700L);
        assertThat(s.getContactoNombre()).isEqualTo("Ana Pérez");
        verify(notificaciones).createNotification(eq("admin-1"), eq("plan"), anyString(), eq("s-1"), eq("/pages/admin.html"));
    }

    @Test
    void noSePidenDosActivacionesALaVez_niPlanesQueNoExisten() {
        when(solicitudes.findFirstByCompanyIdAndEstado("c-1", SolicitudPlan.Estado.PENDIENTE)).thenReturn(Optional.of(new SolicitudPlan()));
        assertThatThrownBy(() -> servicio.solicitar("u-empresa", CatalogoPlanes.PROFESIONAL, 1, null, null, null)).hasMessageContaining("pendiente");
        assertThatThrownBy(() -> servicio.solicitar("u-empresa", "ORO", 1, null, null, null)).hasMessageContaining("no se puede solicitar");
        assertThatThrownBy(() -> servicio.solicitar("u-empresa", CatalogoPlanes.PROFESIONAL, 2, null, null, null)).hasMessageContaining("1, 3 o 6");
    }

    @Test
    void aprobar_activaPorLosMeses_ySiYaTeniaPlanLoExtiende() {
        SolicitudPlan s = new SolicitudPlan(); s.setId("s-1"); s.setCompanyId("c-1"); s.setUserId("u-empresa"); s.setMeses(1); s.setEstado(SolicitudPlan.Estado.PENDIENTE);
        when(solicitudes.findById("s-1")).thenReturn(Optional.of(s));
        LocalDateTime finActual = LocalDateTime.now().plusDays(10);
        when(planes.findById("c-1")).thenReturn(Optional.of(profesionalHasta(finActual)));
        servicio.aprobar("admin-1", "s-1", 1, null);
        assertThat(guardado.getVigenteHasta()).isEqualTo(finActual.plusMonths(1));
        assertThat(s.getEstado()).isEqualTo(SolicitudPlan.Estado.APROBADA);
        verify(notificaciones).createNotification(eq("u-empresa"), eq("plan"), anyString(), eq("s-1"), anyString());
        // ya atendida: no se puede aprobar otra vez
        assertThatThrownBy(() -> servicio.aprobar("admin-1", "s-1", 1, null)).hasMessageContaining("ya fue atendida");
    }

    @Test
    void rechazarPideElMotivo() {
        SolicitudPlan s = new SolicitudPlan(); s.setId("s-1"); s.setCompanyId("c-1"); s.setUserId("u-empresa"); s.setEstado(SolicitudPlan.Estado.PENDIENTE);
        when(solicitudes.findById("s-1")).thenReturn(Optional.of(s));
        assertThatThrownBy(() -> servicio.rechazar("admin-1", "s-1", " ")).hasMessageContaining("motivo");
        servicio.rechazar("admin-1", "s-1", "No recibimos el pago");
        assertThat(s.getEstado()).isEqualTo(SolicitudPlan.Estado.RECHAZADA);
    }

    @Test
    void losDatosDePagoSoloSeMuestranCompletos_yAQuienYaPidioLaActivacion() {
        when(planes.findById("c-1")).thenReturn(Optional.empty());
        ConfiguracionComercial conf = new ConfiguracionComercial();
        conf.setBanco("Banco X"); conf.setNumeroCuenta("123"); conf.setTitular("SkillMatch"); conf.setCorreoPagos("pagos@x.test");
        when(configuraciones.findById(ConfiguracionComercial.ID)).thenReturn(Optional.of(conf));
        Map<String, Object> sin = servicio.resumen("u-empresa");
        assertThat(sin.get("pago")).isNull();
        when(solicitudes.findFirstByCompanyIdAndEstado("c-1", SolicitudPlan.Estado.PENDIENTE)).thenReturn(Optional.of(new SolicitudPlan()));
        assertThat(servicio.resumen("u-empresa").get("pago")).isNotNull();
        conf.setNumeroCuenta(null);
        assertThat(servicio.resumen("u-empresa").get("pago")).isNull();
    }
}
