package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.JobRequest;
import com.skillmatch.backend.dto.JobResponse;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.JobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class JobServiceTest {

    @Mock private JobRepository jobRepository;
    @Mock private CompanyRepository companyRepository;
    @Mock private MongoTemplate mongoTemplate;

    @InjectMocks
    private JobService jobService;

    private Company company;
    private JobRequest request;

    @BeforeEach
    void setUp() {
        company = new Company();
        company.setId("company-a");
        company.setName("Empresa A");
        company.setUserId("owner-a");

        request = new JobRequest();
        request.setCompanyId("company-a");
        request.setTitle("Auxiliar de bodega");
        request.setType("empleo");
    }

    // ─── createJob: solo a nombre de la propia empresa ───────────────────────

    @Test
    void createJob_dueno_publica() {
        when(companyRepository.findById("company-a")).thenReturn(Optional.of(company));
        when(jobRepository.save(any(Job.class))).thenAnswer(inv -> inv.getArgument(0));

        JobResponse result = jobService.createJob(request, "owner-a", false);

        assertThat(result.getCompanyId()).isEqualTo("company-a");
        assertThat(result.getCompanyName()).isEqualTo("Empresa A");
    }

    @Test
    void createJob_otraEmpresa_rechazaYNoGuarda() {
        when(companyRepository.findById("company-a")).thenReturn(Optional.of(company));

        assertThatThrownBy(() -> jobService.createJob(request, "owner-b", false))
                .isInstanceOf(AccessDeniedException.class);
        verify(jobRepository, never()).save(any());
    }

    @Test
    void createJob_admin_puedePublicar() {
        when(companyRepository.findById("company-a")).thenReturn(Optional.of(company));
        when(jobRepository.save(any(Job.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(jobService.createJob(request, "admin-id", true).getCompanyId()).isEqualTo("company-a");
    }

    // ─── Moderación: el ADMIN cierra vacantes ajenas, otra empresa no ────────

    @Test
    void changeStatus_admin_cierraVacanteAjena() {
        stubExistingJob();
        when(jobRepository.save(any(Job.class))).thenAnswer(inv -> inv.getArgument(0));

        JobResponse result = jobService.changeStatus("job-1", "CERRADA", "admin-id", true);

        assertThat(result.getActive()).isFalse();
    }

    @Test
    void changeStatus_otraEmpresa_rechaza() {
        stubExistingJob();

        assertThatThrownBy(() -> jobService.changeStatus("job-1", "CERRADA", "owner-b", false))
                .isInstanceOf(AccessDeniedException.class);
        verify(jobRepository, never()).save(any());
    }

    @Test
    void deleteJob_admin_cierraVacanteAjena() {
        stubExistingJob();

        jobService.deleteJob("job-1", "admin-id", true);

        verify(jobRepository).save(argThat(job -> !job.getActive()));
    }

    private void stubExistingJob() {
        Job job = new Job();
        job.setId("job-1");
        job.setCompanyId("company-a");
        job.setActive(true);
        when(jobRepository.findById("job-1")).thenReturn(Optional.of(job));
        when(companyRepository.findById("company-a")).thenReturn(Optional.of(company));
    }
}
