package com.skillmatch.backend.concurrencia;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.skillmatch.backend.dto.InvitacionRequest;
import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ApplicationStatus;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Invitacion;
import com.skillmatch.backend.model.InvitacionCandidato;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.PlanEmpresa;
import com.skillmatch.backend.model.SolicitudPlan;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.ApplicationRepository;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.ConfiguracionComercialRepository;
import com.skillmatch.backend.repository.InvitacionCandidatoRepository;
import com.skillmatch.backend.repository.InvitacionRepository;
import com.skillmatch.backend.repository.JobRepository;
import com.skillmatch.backend.repository.PlanEmpresaRepository;
import com.skillmatch.backend.repository.SolicitudPlanRepository;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.service.AvisosCorreoService;
import com.skillmatch.backend.service.CerrojoService;
import com.skillmatch.backend.service.InvitacionService;
import com.skillmatch.backend.service.NotificationService;
import com.skillmatch.backend.service.PlanService;

/**
 * Operaciones simultaneas contra un MongoDB de verdad: varias personas pidiendo el ultimo cupo de un
 * horario, una empresa enviando invitaciones desde dos pestañas, dos administradores aprobando la misma
 * solicitud. Con mocks no se puede reproducir: hace falta la base real.
 *
 * Solo corre si SKILLMATCH_MONGO_PRUEBAS apunta a un MongoDB local (nunca a Atlas), por ejemplo:
 *   SKILLMATCH_MONGO_PRUEBAS=mongodb://localhost:27017 ./mvnw test -Dtest=ConcurrenciaMongoTest
 * Usa la base "skillmatch_concurrencia_prueba", que borra al empezar y al terminar.
 */
@EnabledIfEnvironmentVariable(named = "SKILLMATCH_MONGO_PRUEBAS", matches = "mongodb://(localhost|127\\.0\\.0\\.1)(:\\d+)?/?")
class ConcurrenciaMongoTest {

    private static final String BASE = "skillmatch_concurrencia_prueba";
    private static final int HILOS = 8;

    private static MongoClient cliente;
    private static MongoTemplate mongo;

    private InvitacionRepository invitaciones;
    private InvitacionCandidatoRepository invitados;
    private ApplicationRepository applications;
    private JobRepository jobs;
    private CompanyRepository companies;
    private UserRepository users;
    private PlanEmpresaRepository planesRepo;
    private SolicitudPlanRepository solicitudes;
    private PlanService planes;
    private InvitacionService servicio;

    @BeforeAll
    static void conectar() {
        cliente = MongoClients.create(System.getenv("SKILLMATCH_MONGO_PRUEBAS"));
        mongo = new MongoTemplate(cliente, BASE);
    }

    @AfterAll
    static void cerrar() {
        mongo.getDb().drop();
        cliente.close();
    }

    @BeforeEach
    void preparar() {
        mongo.getDb().drop();
        MongoRepositoryFactory f = new MongoRepositoryFactory(mongo);
        invitaciones = f.getRepository(InvitacionRepository.class);
        invitados = f.getRepository(InvitacionCandidatoRepository.class);
        applications = f.getRepository(ApplicationRepository.class);
        jobs = f.getRepository(JobRepository.class);
        companies = f.getRepository(CompanyRepository.class);
        users = f.getRepository(UserRepository.class);
        planesRepo = f.getRepository(PlanEmpresaRepository.class);
        solicitudes = f.getRepository(SolicitudPlanRepository.class);
        CerrojoService cerrojos = new CerrojoService(mongo);
        NotificationService notificaciones = mock(NotificationService.class);
        planes = new PlanService(planesRepo, solicitudes, f.getRepository(ConfiguracionComercialRepository.class),
                invitados, invitaciones, companies, users, notificaciones, mongo, cerrojos);
        servicio = new InvitacionService(invitaciones, invitados, applications, jobs, companies, users, planes,
                notificaciones, mock(AvisosCorreoService.class), cerrojos);

        Company c = new Company();
        c.setId("c-1"); c.setUserId("u-empresa"); c.setName("Hotel Bahía");
        companies.save(c);
        Job v = new Job();
        v.setId("j-1"); v.setCompanyId("c-1"); v.setTitle("Recepcionista");
        jobs.save(v);
        usuario("u-empresa");
    }

    // ------------------------------------------------------------------ cupos de un horario

    @Test
    void variasPersonasPidenElUltimoCupoDeUnHorarioYSoloUnaLoObtiene() throws Exception {
        List<String> ids = new ArrayList<>();
        for (int k = 0; k < HILOS; k++) ids.add(postulante("p" + k));
        InvitacionRequest r = pedido(ids, 1);
        servicio.crear("u-empresa", r);
        Invitacion inv = invitaciones.findAll().get(0);
        String horario = inv.getHorarios().get(0).getId();

        List<Callable<Object>> tareas = new ArrayList<>();
        for (InvitacionCandidato ic : invitados.findAll()) {
            tareas.add(() -> servicio.responder(ic.getUserId(), ic.getId(), true, horario, null));
        }
        Resultado res = aLaVez(tareas);

        assertThat(invitados.countByInvitacionIdAndHorarioIdAndEstado(inv.getId(), horario, InvitacionCandidato.Estado.CONFIRMADA))
                .as("confirmados en un horario de 1 cupo").isEqualTo(1);
        assertThat(res.bien).isEqualTo(1);
        assertThat(res.errores).allMatch(m -> m.contains("se llenó"));
    }

    @Test
    void cancelarElProcesoMientrasAlguienConfirmaNoDejaConfirmacionesVivas() throws Exception {
        String a = postulante("p1");
        servicio.crear("u-empresa", pedido(List.of(a), 3));
        Invitacion inv = invitaciones.findAll().get(0);
        InvitacionCandidato ic = invitados.findAll().get(0);
        String horario = inv.getHorarios().get(0).getId();
        aLaVez(List.of(
                () -> servicio.responder(ic.getUserId(), ic.getId(), true, horario, null),
                () -> servicio.cancelar("u-empresa", inv.getId())));
        assertThat(invitados.findById(ic.getId()).orElseThrow().getEstado()).isEqualTo(InvitacionCandidato.Estado.CANCELADA);
    }

    @Test
    void elRecordatorioNoBorraUnaRespuestaQueLlegaAlMismoTiempo() throws Exception {
        PlanEmpresa p = new PlanEmpresa("c-1");
        p.setPlan("PROFESIONAL"); p.setVigenteHasta(LocalDateTime.now().plusMonths(1));
        planesRepo.save(p);
        List<String> ids = new ArrayList<>();
        for (int k = 0; k < HILOS; k++) ids.add(postulante("p" + k));
        servicio.crear("u-empresa", pedido(ids, HILOS));
        Invitacion inv = invitaciones.findAll().get(0);
        String horario = inv.getHorarios().get(0).getId();
        List<Callable<Object>> tareas = new ArrayList<>();
        tareas.add(() -> servicio.recordar("u-empresa", inv.getId()));
        for (InvitacionCandidato ic : invitados.findAll()) {
            tareas.add(() -> servicio.responder(ic.getUserId(), ic.getId(), true, horario, null));
        }
        aLaVez(tareas);
        assertThat(invitados.findAll()).as("nadie vuelve a quedar sin responder")
                .allMatch(ic -> ic.getEstado() == InvitacionCandidato.Estado.CONFIRMADA);
    }

    // ------------------------------------------------------------------ limites del plan

    @Test
    void conUnaInvitacionLibreEnElMesDosEnviosALaVezSoloDejanPasarUno() throws Exception {
        for (int k = 0; k < 19; k++) {             // el plan Basico da 20 al mes; ya se usaron 19
            InvitacionCandidato ic = new InvitacionCandidato();
            ic.setCompanyId("c-1"); ic.setInvitacionId("viejo"); ic.setEstado(InvitacionCandidato.Estado.RECHAZADA);
            ic.setCreatedAt(LocalDateTime.now());
            invitados.save(ic);
        }
        List<Callable<Object>> tareas = new ArrayList<>();
        for (int k = 0; k < HILOS; k++) {
            String a = postulante("p" + k);
            tareas.add(() -> servicio.crear("u-empresa", pedido(List.of(a), 1)));
        }
        Resultado res = aLaVez(tareas);
        assertThat(planes.invitacionesDelMes("c-1")).as("invitaciones del mes").isEqualTo(20);
        assertThat(res.bien).isEqualTo(1);
    }

    @Test
    void elLimiteDeProcesosAbiertosAguantaEnviosSimultaneos() throws Exception {
        List<Callable<Object>> tareas = new ArrayList<>();
        for (int k = 0; k < HILOS; k++) {
            String a = postulante("p" + k);
            tareas.add(() -> servicio.crear("u-empresa", pedido(List.of(a), 1)));
        }
        Resultado res = aLaVez(tareas);
        assertThat(planes.procesosActivos("c-1")).as("procesos abiertos en el plan Básico").isEqualTo(2);
        assertThat(res.bien).isEqualTo(2);
    }

    @Test
    void laMismaPersonaNoQuedaInvitadaDosVecesPorDosEnviosALaVez() throws Exception {
        PlanEmpresa p = new PlanEmpresa("c-1");
        p.setPlan("PROFESIONAL"); p.setVigenteHasta(LocalDateTime.now().plusMonths(1));
        planesRepo.save(p);
        String a = postulante("p1");
        List<Callable<Object>> tareas = new ArrayList<>();
        for (int k = 0; k < HILOS; k++) tareas.add(() -> servicio.crear("u-empresa", pedido(List.of(a), 1)));
        aLaVez(tareas);
        assertThat(invitados.findAll()).hasSize(1);
    }

    // ------------------------------------------------------------------ solicitudes de plan

    @Test
    void dosAdministradoresApruebanLaMismaSolicitudYElPlanSoloSeSumaUnaVez() throws Exception {
        SolicitudPlan s = planes.solicitar("u-empresa", "PROFESIONAL", 1, null, null, null);
        List<Callable<Object>> tareas = new ArrayList<>();
        for (int k = 0; k < HILOS; k++) {
            String admin = "admin-" + k;
            tareas.add(() -> planes.aprobar(admin, s.getId(), null, null));
        }
        Resultado res = aLaVez(tareas);
        PlanEmpresa p = planesRepo.findById("c-1").orElseThrow();
        assertThat(res.bien).isEqualTo(1);
        assertThat(p.getVigenteHasta()).as("un solo mes de vigencia")
                .isBefore(LocalDateTime.now().plusMonths(1).plusMinutes(1));
    }

    @Test
    void aprobarYCancelarALaVezDejanUnSoloResultado() throws Exception {
        SolicitudPlan s = planes.solicitar("u-empresa", "PROFESIONAL", 1, null, null, null);
        Resultado res = aLaVez(List.of(
                () -> planes.aprobar("admin", s.getId(), null, null),
                () -> planes.cancelarSolicitud("u-empresa", s.getId())));
        assertThat(res.bien).isEqualTo(1);
        SolicitudPlan final_ = solicitudes.findById(s.getId()).orElseThrow();
        boolean activo = planesRepo.findById("c-1").isPresent();
        assertThat(activo).isEqualTo(final_.getEstado() == SolicitudPlan.Estado.APROBADA);
    }

    @Test
    void variasSolicitudesALaVezDejanUnaSolaPendiente() throws Exception {
        List<Callable<Object>> tareas = new ArrayList<>();
        for (int k = 0; k < HILOS; k++) tareas.add(() -> planes.solicitar("u-empresa", "PROFESIONAL", 1, null, null, null));
        aLaVez(tareas);
        assertThat(solicitudes.findAll().stream().filter(x -> x.getEstado() == SolicitudPlan.Estado.PENDIENTE)).hasSize(1);
    }

    // ------------------------------------------------------------------ tope de correos

    @Test
    void elTopeDeCorreosAguantaEnviosSimultaneosYLoQueSobraQuedaEnCola() throws Exception {
        com.skillmatch.backend.service.CorreoService correo = mock(com.skillmatch.backend.service.CorreoService.class);
        org.mockito.Mockito.when(correo.enviar(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString())).thenReturn(true);
        com.skillmatch.backend.service.ColaCorreoService cola = new com.skillmatch.backend.service.ColaCorreoService(correo, mongo, 5);
        List<Callable<Object>> tareas = new ArrayList<>();
        for (int k = 0; k < 20; k++) {
            tareas.add(() -> cola.enviar("a@correo.co", "asunto", "texto",
                    com.skillmatch.backend.service.ColaCorreoService.Prioridad.ALTA, java.time.Duration.ofDays(1)));
        }
        aLaVez(tareas);
        org.mockito.Mockito.verify(correo, org.mockito.Mockito.times(5)).enviar(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
        assertThat(cola.estado()).containsEntry("enviadosHoy", 5).containsEntry("pendientes", 15L);
    }

    // ------------------------------------------------------------------ ayudas

    private record Resultado(int bien, List<String> errores) { }

    /** Lanza todas las tareas en el mismo instante y cuenta cuantas salieron bien. */
    private static Resultado aLaVez(List<Callable<Object>> tareas) throws Exception {
        ExecutorService ex = Executors.newFixedThreadPool(tareas.size());
        CountDownLatch salida = new CountDownLatch(1);
        List<Future<Object>> futuros = new ArrayList<>();
        for (Callable<Object> t : tareas) futuros.add(ex.submit(() -> { salida.await(); return t.call(); }));
        salida.countDown();
        int bien = 0;
        List<String> errores = new ArrayList<>();
        for (Future<Object> f : futuros) {
            try { f.get(30, TimeUnit.SECONDS); bien++; }
            catch (java.util.concurrent.ExecutionException e) { errores.add(String.valueOf(e.getCause().getMessage())); }
        }
        ex.shutdownNow();
        return new Resultado(bien, errores);
    }

    private void usuario(String id) {
        User u = new User();
        u.setId(id); u.setFirstName(id); u.setEmail(id + "@prueba.test");
        users.save(u);
    }

    private String postulante(String userId) {
        usuario(userId);
        Application a = new Application();
        a.setUserId(userId); a.setJobId("j-1"); a.setStatus(ApplicationStatus.PENDIENTE);
        return applications.save(a).getId();
    }

    private static InvitacionRequest pedido(List<String> applicationIds, int cupos) {
        InvitacionRequest r = new InvitacionRequest();
        r.setJobId("j-1");
        r.setApplicationIds(applicationIds);
        r.setTipo("ENTREVISTA");
        r.setModalidad("PRESENCIAL");
        r.setLugar("Cra. 3 # 10-20");
        r.setDuracionMinutos(30);
        InvitacionRequest.HorarioRequest h = new InvitacionRequest.HorarioRequest();
        h.setInicio(LocalDateTime.now().plusDays(3).withNano(0));
        h.setCupos(cupos);
        r.setHorarios(List.of(h));
        return r;
    }
}
