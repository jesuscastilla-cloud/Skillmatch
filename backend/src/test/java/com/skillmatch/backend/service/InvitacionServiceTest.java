package com.skillmatch.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

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

/** Invitar a la siguiente etapa: permisos, cupos del plan, horarios, plazos y respuestas. */
class InvitacionServiceTest {

    private final InvitacionRepository invitaciones = mock(InvitacionRepository.class);
    private final InvitacionCandidatoRepository invitados = mock(InvitacionCandidatoRepository.class);
    private final ApplicationRepository applications = mock(ApplicationRepository.class);
    private final JobRepository jobs = mock(JobRepository.class);
    private final CompanyRepository companies = mock(CompanyRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final PlanService planes = mock(PlanService.class);
    private final NotificationService notificaciones = mock(NotificationService.class);
    private final AvisosCorreoService correos = mock(AvisosCorreoService.class);
    private final InvitacionService servicio = new InvitacionService(invitaciones, invitados, applications, jobs, companies, users, planes, notificaciones, correos, new SinCerrojo());

    private final Company empresa = new Company();
    private final Job vacante = new Job();
    private final List<InvitacionCandidato> guardados = new ArrayList<>();
    private Invitacion guardada;

    @BeforeEach
    void preparar() {
        empresa.setId("c-1"); empresa.setUserId("u-empresa"); empresa.setName("Hotel Bahía");
        vacante.setId("j-1"); vacante.setCompanyId("c-1"); vacante.setTitle("Recepcionista");
        when(planes.empresaDe("u-empresa")).thenReturn(empresa);
        when(planes.planVigente("c-1")).thenReturn(CatalogoPlanes.PLAN_BASICO);
        when(planes.invitacionesDelMes("c-1")).thenReturn(0L);
        when(planes.procesosActivos("c-1")).thenReturn(0L);
        when(jobs.findById("j-1")).thenReturn(Optional.of(vacante));
        when(companies.findById("c-1")).thenReturn(Optional.of(empresa));
        when(invitaciones.save(any())).thenAnswer(i -> { Invitacion x = i.getArgument(0); if (x.getId() == null) x.setId("inv-1"); guardada = x; return x; });
        when(invitaciones.findById("inv-1")).thenAnswer(i -> Optional.ofNullable(guardada));
        when(invitados.saveAll(any())).thenAnswer(i -> {
            List<InvitacionCandidato> l = new ArrayList<>(i.getArgument(0));
            for (int k = 0; k < l.size(); k++) l.get(k).setId("ic-" + k);
            guardados.addAll(l); return l;
        });
        when(invitados.findByInvitacionId("inv-1")).thenAnswer(i -> guardados);
        when(invitados.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private Application postulacion(String id, String jobId, ApplicationStatus estado) {
        Application a = new Application(); a.setId(id); a.setJobId(jobId); a.setUserId("persona-" + id); a.setStatus(estado);
        return a;
    }

    private InvitacionRequest pedido(String... ids) {
        InvitacionRequest r = new InvitacionRequest();
        r.setJobId("j-1"); r.setApplicationIds(List.of(ids)); r.setTipo("ENTREVISTA"); r.setModalidad("PRESENCIAL");
        r.setLugar("Cra. 3 # 10-20, Bocagrande"); r.setDuracionMinutos(30);
        InvitacionRequest.HorarioRequest h1 = new InvitacionRequest.HorarioRequest(); h1.setInicio(LocalDateTime.now().plusDays(3).withSecond(0).withNano(0)); h1.setCupos(2);
        InvitacionRequest.HorarioRequest h2 = new InvitacionRequest.HorarioRequest(); h2.setInicio(LocalDateTime.now().plusDays(4).withSecond(0).withNano(0)); h2.setCupos(2);
        r.setHorarios(List.of(h1, h2));
        return r;
    }

    @Test
    void invitaAVariosDeUnaVez_yAvisaACadaUno() {
        when(applications.findAllById(any())).thenReturn(List.of(postulacion("a1", "j-1", ApplicationStatus.PENDIENTE), postulacion("a2", "j-1", ApplicationStatus.REVISADA)));
        Map<String, Object> r = servicio.crear("u-empresa", pedido("a1", "a2"));
        assertThat(guardados).hasSize(2).allMatch(ic -> ic.getEstado() == InvitacionCandidato.Estado.PENDIENTE && "c-1".equals(ic.getCompanyId()));
        assertThat(r.get("total")).isEqualTo(2);
        verify(notificaciones, times(2)).createNotification(anyString(), eq("invitacion"), anyString(), anyString(), anyString());
        // por defecto se puede responder hasta 2 horas antes del primer horario
        assertThat(guardada.getRespondeAntesDe()).isEqualTo(guardada.getHorarios().get(0).getInicio().minusHours(2));
    }

    @Test
    void unaEmpresaNoInvitaAPostulantesDeOtraEmpresa() {
        vacante.setCompanyId("otra");
        assertThatThrownBy(() -> servicio.crear("u-empresa", pedido("a1"))).isInstanceOf(AccessDeniedException.class);
        verify(invitaciones, never()).save(any());
    }

    @Test
    void noInvitaPostulacionesDeOtraVacante_niRetiradas_niRechazadas() {
        when(applications.findAllById(any())).thenReturn(List.of(postulacion("a1", "j-otra", ApplicationStatus.PENDIENTE)));
        assertThatThrownBy(() -> servicio.crear("u-empresa", pedido("a1"))).hasMessageContaining("no se postularon");
        when(applications.findAllById(any())).thenReturn(List.of(postulacion("a1", "j-1", ApplicationStatus.RETIRADA)));
        assertThatThrownBy(() -> servicio.crear("u-empresa", pedido("a1"))).hasMessageContaining("retiró");
        when(applications.findAllById(any())).thenReturn(List.of(postulacion("a1", "j-1", ApplicationStatus.RECHAZADA)));
        assertThatThrownBy(() -> servicio.crear("u-empresa", pedido("a1"))).hasMessageContaining("rechazado");
    }

    @Test
    void respetaElCupoDelMes_elTamanoDelEnvio_yLosProcesosAbiertos() {
        when(planes.invitacionesDelMes("c-1")).thenReturn(19L);
        assertThatThrownBy(() -> servicio.crear("u-empresa", pedido("a1", "a2"))).isInstanceOf(CupoAgotadoException.class).hasMessageContaining("Te quedan 1");
        when(planes.invitacionesDelMes("c-1")).thenReturn(20L);
        assertThatThrownBy(() -> servicio.crear("u-empresa", pedido("a1"))).isInstanceOf(CupoAgotadoException.class).hasMessageContaining("Ya usaste");
        when(planes.invitacionesDelMes("c-1")).thenReturn(0L);
        String[] once = new String[11]; for (int i = 0; i < 11; i++) once[i] = "a" + i;
        assertThatThrownBy(() -> servicio.crear("u-empresa", pedido(once))).isInstanceOf(CupoAgotadoException.class).hasMessageContaining("hasta 10");
        when(planes.procesosActivos("c-1")).thenReturn(2L);
        assertThatThrownBy(() -> servicio.crear("u-empresa", pedido("a1"))).isInstanceOf(CupoAgotadoException.class).hasMessageContaining("procesos abiertos");
    }

    @Test
    void noRepiteUnaInvitacionAbiertaParaLaMismaVacante() {
        when(applications.findAllById(any())).thenReturn(List.of(postulacion("a1", "j-1", ApplicationStatus.PENDIENTE)));
        InvitacionCandidato ya = new InvitacionCandidato(); ya.setInvitacionId("inv-vieja"); ya.setEstado(InvitacionCandidato.Estado.PENDIENTE);
        Invitacion vieja = new Invitacion(); vieja.setEstado(Invitacion.Estado.ACTIVA);
        when(invitaciones.findById("inv-vieja")).thenReturn(Optional.of(vieja));
        when(invitados.findByJobIdAndApplicationIdInAndEstadoIn(eq("j-1"), any(), any())).thenReturn(List.of(ya));
        assertThatThrownBy(() -> servicio.crear("u-empresa", pedido("a1"))).hasMessageContaining("ya tiene una invitación abierta");
    }

    @Test
    void horariosYPlazosConSentido() {
        when(applications.findAllById(any())).thenReturn(List.of(postulacion("a1", "j-1", ApplicationStatus.PENDIENTE)));
        InvitacionRequest pasado = pedido("a1");
        pasado.getHorarios().get(0).setInicio(LocalDateTime.now().minusDays(1));
        assertThatThrownBy(() -> servicio.crear("u-empresa", pasado)).hasMessageContaining("2 horas después");
        InvitacionRequest lejos = pedido("a1");
        lejos.getHorarios().get(0).setInicio(LocalDateTime.now().plusDays(90));
        assertThatThrownBy(() -> servicio.crear("u-empresa", lejos)).hasMessageContaining("60 días");
        InvitacionRequest tarde = pedido("a1");
        tarde.setRespondeAntesDe(LocalDateTime.now().plusDays(10));
        assertThatThrownBy(() -> servicio.crear("u-empresa", tarde)).hasMessageContaining("antes del primer horario");
        InvitacionRequest muchos = pedido("a1");
        List<InvitacionRequest.HorarioRequest> cuatro = new ArrayList<>();
        for (int i = 1; i <= 4; i++) { InvitacionRequest.HorarioRequest h = new InvitacionRequest.HorarioRequest(); h.setInicio(LocalDateTime.now().plusDays(i + 1)); h.setCupos(1); cuatro.add(h); }
        muchos.setHorarios(cuatro);
        assertThatThrownBy(() -> servicio.crear("u-empresa", muchos)).isInstanceOf(CupoAgotadoException.class).hasMessageContaining("hasta 3 horarios");
        InvitacionRequest virtualSinEnlace = pedido("a1");
        virtualSinEnlace.setModalidad("VIRTUAL");
        assertThatThrownBy(() -> servicio.crear("u-empresa", virtualSinEnlace)).hasMessageContaining("enlace");
    }

    // ---------------------------------------------------------------- respuestas del candidato

    private InvitacionCandidato invitadoDe(String userId) {
        when(applications.findAllById(any())).thenReturn(List.of(postulacion("a1", "j-1", ApplicationStatus.PENDIENTE)));
        servicio.crear("u-empresa", pedido("a1"));
        InvitacionCandidato ic = guardados.get(0);
        ic.setUserId(userId);
        when(invitados.findById(ic.getId())).thenReturn(Optional.of(ic));
        return ic;
    }

    @Test
    void elCandidatoConfirmaUnHorario_yLaEmpresaSeEntera() {
        InvitacionCandidato ic = invitadoDe("persona-1");
        String horario = guardada.getHorarios().get(0).getId();
        Map<String, Object> r = servicio.responder("persona-1", ic.getId(), true, horario, "Llevo mi hoja de vida");
        assertThat(ic.getEstado()).isEqualTo(InvitacionCandidato.Estado.CONFIRMADA);
        assertThat(ic.getHorarioId()).isEqualTo(horario);
        assertThat(r.get("lugar")).isEqualTo("Cra. 3 # 10-20, Bocagrande");
        verify(notificaciones).createNotification(eq("u-empresa"), eq("invitacion_respuesta"), anyString(), eq("inv-1"), anyString());
    }

    @Test
    void antesDeConfirmarYaVeLaDireccionYLasIndicaciones_PeroNoElEnlacePrivado() {
        InvitacionCandidato ic = invitadoDe("persona-1");
        when(invitados.findByUserIdOrderByCreatedAtDesc("persona-1")).thenReturn(List.of(ic));
        guardada.setIndicaciones("Trae tu documento.");
        guardada.setEnlace("https://reunion.example.com/privada");
        Map<String, Object> antes = servicio.mias("persona-1").get(0);
        assertThat(antes.get("lugar")).isEqualTo("Cra. 3 # 10-20, Bocagrande");
        assertThat(antes.get("indicaciones")).isEqualTo("Trae tu documento.");
        assertThat(antes.get("enlace")).as("el enlace espera a la confirmacion").isNull();

        servicio.responder("persona-1", ic.getId(), true, guardada.getHorarios().get(0).getId(), null);
        assertThat(servicio.mias("persona-1").get(0).get("enlace")).isEqualTo("https://reunion.example.com/privada");
    }

    @Test
    void elCandidatoPuedeDecirQueNoPuede() {
        InvitacionCandidato ic = invitadoDe("persona-1");
        servicio.responder("persona-1", ic.getId(), false, null, "Estoy de viaje");
        assertThat(ic.getEstado()).isEqualTo(InvitacionCandidato.Estado.RECHAZADA);
        assertThat(ic.getComentario()).isEqualTo("Estoy de viaje");
    }

    @Test
    void nadieRespondeLaInvitacionDeOtro() {
        InvitacionCandidato ic = invitadoDe("persona-1");
        assertThatThrownBy(() -> servicio.responder("intruso", ic.getId(), true, guardada.getHorarios().get(0).getId(), null))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void unHorarioLlenoNoAceptaMas() {
        InvitacionCandidato ic = invitadoDe("persona-1");
        String horario = guardada.getHorarios().get(0).getId();
        when(invitados.countByInvitacionIdAndHorarioIdAndEstado("inv-1", horario, InvitacionCandidato.Estado.CONFIRMADA)).thenReturn(2L);
        assertThatThrownBy(() -> servicio.responder("persona-1", ic.getId(), true, horario, null)).hasMessageContaining("se llenó");
    }

    @Test
    void despuesDelPlazo_oCancelada_yaNoSeResponde() {
        InvitacionCandidato ic = invitadoDe("persona-1");
        guardada.setRespondeAntesDe(LocalDateTime.now().minusMinutes(1));
        assertThatThrownBy(() -> servicio.responder("persona-1", ic.getId(), false, null, null)).hasMessageContaining("plazo");
        assertThat(InvitacionService.estadoReal(ic, guardada)).isEqualTo(InvitacionCandidato.Estado.VENCIDA);
        guardada.setRespondeAntesDe(LocalDateTime.now().plusDays(1));
        guardada.setEstado(Invitacion.Estado.CANCELADA);
        assertThatThrownBy(() -> servicio.responder("persona-1", ic.getId(), false, null, null)).hasMessageContaining("canceló");
    }

    @Test
    void losRecordatoriosSonDelPlanProfesional() {
        invitadoDe("persona-1");
        assertThatThrownBy(() -> servicio.recordar("u-empresa", "inv-1")).isInstanceOf(CupoAgotadoException.class);
        when(planes.planVigente("c-1")).thenReturn(CatalogoPlanes.PLAN_PROFESIONAL);
        when(users.findById(anyString())).thenReturn(Optional.of(new User()));
        Map<String, Object> r = servicio.recordar("u-empresa", "inv-1");
        assertThat(r.get("recordados")).isEqualTo(1);
        // otra vez enseguida: no se le vuelve a escribir (una vez cada 24 horas)
        assertThat(servicio.recordar("u-empresa", "inv-1").get("recordados")).isEqualTo(0);
        verify(correos, times(1)).invitacion(any(), anyString(), any(), anyString(), eq(true));
    }

    @Test
    void cancelarAvisaAQuienesEstabanInvitados() {
        invitadoDe("persona-1");
        servicio.cancelar("u-empresa", "inv-1");
        assertThat(guardada.getEstado()).isEqualTo(Invitacion.Estado.CANCELADA);
        assertThat(guardados.get(0).getEstado()).isEqualTo(InvitacionCandidato.Estado.CANCELADA);
        // un aviso al invitar y otro al cancelar
        verify(notificaciones, times(2)).createNotification(anyString(), eq("invitacion"), anyString(), anyString(), anyString());
    }

    @Test
    void otraEmpresaNoVeNiCancelaElProceso() {
        invitadoDe("persona-1");
        Company otra = new Company(); otra.setId("c-2");
        when(planes.empresaDe("u-otra")).thenReturn(otra);
        assertThatThrownBy(() -> servicio.detalle("u-otra", "inv-1")).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> servicio.cancelar("u-otra", "inv-1")).isInstanceOf(ResourceNotFoundException.class);
    }
}
