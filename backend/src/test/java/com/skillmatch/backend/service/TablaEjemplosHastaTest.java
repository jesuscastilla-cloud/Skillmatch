package com.skillmatch.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ApplicationStatus;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.ApplicationRepository;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.JobRepository;
import com.skillmatch.backend.repository.UserRepository;

/**
 * La tabla «como estaba» en una fecha (la usa el sembrado para reconstruir los entrenamientos de las
 * ultimas semanas): solo lo que ya existia y lo que la empresa ya habia respondido ese dia.
 */
class TablaEjemplosHastaTest {

    private static final LocalDateTime CORTE = LocalDateTime.of(2026, 11, 10, 3, 30);

    private final ApplicationRepository applications = mock(ApplicationRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final JobRepository jobs = mock(JobRepository.class);
    private final CompanyRepository companies = mock(CompanyRepository.class);
    private final TablaEjemplosService servicio = new TablaEjemplosService(applications, users, jobs, companies);

    private Application postulacion(String id, String userId, LocalDateTime postulo, ApplicationStatus estado, LocalDateTime respondida) {
        Application a = new Application();
        a.setId(id);
        a.setUserId(userId);
        a.setJobId("j-1");
        a.setAppliedDate(postulo);
        a.setStatus(estado);
        a.setReviewedDate(respondida);
        return a;
    }

    @Test
    void enUnaFechaPasadaSoloEntraLoQueYaEstabaRespondido() {
        User u = new User();
        u.setId("u-1");
        Job j = new Job();
        j.setId("j-1"); j.setCompanyId("c-1"); j.setPostedDate(CORTE.minusDays(30)); j.setSkills(List.of("Excel"));
        Company c = new Company();
        c.setId("c-1"); c.setName("Hotel Bahía");
        when(users.findAll()).thenReturn(List.of(u));
        when(jobs.findAll()).thenReturn(List.of(j));
        when(companies.findAll()).thenReturn(List.of(c));
        when(applications.findAll()).thenReturn(List.of(
                postulacion("a-1", "u-1", CORTE.minusDays(20), ApplicationStatus.ACEPTADA, CORTE.minusDays(15)),   // respondida antes: entra
                postulacion("a-2", "u-1", CORTE.minusDays(10), ApplicationStatus.RECHAZADA, CORTE.plusDays(2)),    // respondida despues: seguia pendiente
                postulacion("a-3", "u-1", CORTE.plusDays(1), ApplicationStatus.ACEPTADA, CORTE.plusDays(3)),       // ni existia
                postulacion("a-4", "u-1", CORTE.minusDays(5), ApplicationStatus.PENDIENTE, null)));                // sin respuesta: nunca entra

        assertThat(servicio.filas(CORTE)).hasSize(1);
        assertThat(servicio.filas()).as("hoy entran las tres respondidas").hasSize(3);
    }
}
