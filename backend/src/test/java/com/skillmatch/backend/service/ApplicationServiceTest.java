package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.ApplicationRequest;
import com.skillmatch.backend.dto.ApplicationResponse;
import com.skillmatch.backend.exception.DuplicateResourceException;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ApplicationStatus;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.JobStatus;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.ApplicationRepository;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.JobRepository;
import com.skillmatch.backend.repository.UserRepository;
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
class ApplicationServiceTest {

    @Mock private ApplicationRepository applicationRepository;
    @Mock private CompanyRepository companyRepository;
    @Mock private JobRepository jobRepository;
    @Mock private UserRepository userRepository;
    @Mock private MongoTemplate mongoTemplate;

    @InjectMocks
    private ApplicationService applicationService;

    private User applicant;
    private User companyOwner;
    private Company company;
    private Job openJob;

    @BeforeEach
    void setUp() {
        applicant = new User();
        applicant.setId("user-id-1");
        applicant.setEmail("user@test.com");
        applicant.setFirstName("Ana");
        applicant.setLastName("García");

        companyOwner = new User();
        companyOwner.setId("user-id-2");

        company = new Company();
        company.setId("company-id-10");
        company.setName("TechCorp");
        company.setUserId("user-id-2");

        openJob = new Job();
        openJob.setId("job-id-5");
        openJob.setTitle("Backend Dev");
        openJob.setActive(true);
        openJob.setStatus(JobStatus.ABIERTA);
        openJob.setCompanyId("company-id-10");
    }

    @Test
    void createApplication_validRequest_savesAndReturnsResponse() {
        ApplicationRequest request = new ApplicationRequest("job-id-5", "mi cv", "carta de presentación");

        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(applicant));
        when(jobRepository.findById("job-id-5")).thenReturn(Optional.of(openJob));
        when(applicationRepository.existsByUserIdAndJobId("user-id-1", "job-id-5")).thenReturn(false);

        Application saved = new Application();
        saved.setId("app-id-100");
        saved.setUserId("user-id-1");
        saved.setJobId("job-id-5");
        saved.setStatus(ApplicationStatus.PENDIENTE);
        when(applicationRepository.save(any(Application.class))).thenReturn(saved);

        when(companyRepository.findById("company-id-10")).thenReturn(Optional.of(company));

        ApplicationResponse response = applicationService.createApplication("user-id-1", request);

        assertThat(response.getId()).isEqualTo("app-id-100");
        assertThat(response.getStatus()).isEqualTo("pendiente");
        verify(applicationRepository).save(any(Application.class));
    }

    @Test
    void createApplication_closedJob_throwsRuntimeException() {
        openJob.setStatus(JobStatus.CERRADA);
        openJob.setActive(false);
        ApplicationRequest request = new ApplicationRequest("job-id-5", null, null);

        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(applicant));
        when(jobRepository.findById("job-id-5")).thenReturn(Optional.of(openJob));

        assertThatThrownBy(() -> applicationService.createApplication("user-id-1", request))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("no está disponible");
    }

    @Test
    void createApplication_alreadyApplied_throwsDuplicateResourceException() {
        ApplicationRequest request = new ApplicationRequest("job-id-5", null, null);

        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(applicant));
        when(jobRepository.findById("job-id-5")).thenReturn(Optional.of(openJob));
        when(applicationRepository.existsByUserIdAndJobId("user-id-1", "job-id-5")).thenReturn(true);

        assertThatThrownBy(() -> applicationService.createApplication("user-id-1", request))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void updateStatus_validStatus_changesStatus() {
        Application application = new Application();
        application.setId("app-id-50");
        application.setUserId("user-id-1");
        application.setJobId("job-id-5");
        application.setStatus(ApplicationStatus.PENDIENTE);

        when(applicationRepository.findById("app-id-50")).thenReturn(Optional.of(application));
        when(jobRepository.findById("job-id-5")).thenReturn(Optional.of(openJob));
        when(companyRepository.findById("company-id-10")).thenReturn(Optional.of(company));
        when(applicationRepository.save(any(Application.class))).thenAnswer(inv -> inv.getArgument(0));

        // loadAndMapSingle after save
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(applicant));

        ApplicationResponse result = applicationService.updateStatus("app-id-50", "aceptada", null, "user-id-2");

        assertThat(result.getStatus()).isEqualTo("aceptada");
    }

    @Test
    void updateStatus_invalidStatus_throwsIllegalArgumentException() {
        Application application = new Application();
        application.setId("app-id-50");
        application.setUserId("user-id-1");
        application.setJobId("job-id-5");
        application.setStatus(ApplicationStatus.PENDIENTE);

        when(applicationRepository.findById("app-id-50")).thenReturn(Optional.of(application));
        when(jobRepository.findById("job-id-5")).thenReturn(Optional.of(openJob));
        when(companyRepository.findById("company-id-10")).thenReturn(Optional.of(company));

        assertThatThrownBy(() -> applicationService.updateStatus("app-id-50", "invalido", null, "user-id-2"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateStatus_wrongOwner_throwsAccessDeniedException() {
        Company otherCompany = new Company();
        otherCompany.setId("other-company-id");
        otherCompany.setUserId("user-id-99");

        Job otherJob = new Job();
        otherJob.setId("other-job-id");
        otherJob.setCompanyId("other-company-id");

        Application application = new Application();
        application.setId("app-id-60");
        application.setUserId("user-id-1");
        application.setJobId("other-job-id");
        application.setStatus(ApplicationStatus.PENDIENTE);

        when(applicationRepository.findById("app-id-60")).thenReturn(Optional.of(application));
        when(jobRepository.findById("other-job-id")).thenReturn(Optional.of(otherJob));
        when(companyRepository.findById("other-company-id")).thenReturn(Optional.of(otherCompany));

        assertThatThrownBy(() -> applicationService.updateStatus("app-id-60", "aceptada", null, "user-id-2"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void getApplicationById_notFound_throwsResourceNotFoundException() {
        when(applicationRepository.findById("app-id-999")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> applicationService.getApplicationById("app-id-999"))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
