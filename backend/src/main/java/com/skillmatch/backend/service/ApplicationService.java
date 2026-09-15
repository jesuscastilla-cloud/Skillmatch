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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final CompanyRepository companyRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    public ApplicationResponse createApplication(String userId, ApplicationRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado con ID: " + userId));

        String jobId = request.getJobId();
        if (jobId == null || jobId.isBlank()) {
            throw new IllegalArgumentException("El ID del job no puede ser nulo");
        }
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job no encontrado con ID: " + jobId));

        if (!Boolean.TRUE.equals(job.getActive()) || job.getStatus() != JobStatus.ABIERTA) {
            throw new RuntimeException("El job no está disponible para postulaciones");
        }
        if (applicationRepository.existsByUserIdAndJobId(userId, jobId)) {
            throw new DuplicateResourceException("Ya te has postulado a esta oferta");
        }

        Application application = new Application();
        application.setUserId(userId);
        application.setJobId(jobId);
        application.setResume(request.getResume());
        application.setCoverLetter(request.getCoverLetter());
        application.setStatus(ApplicationStatus.PENDIENTE);
        application.setAppliedDate(LocalDateTime.now());
        application.setCreatedAt(LocalDateTime.now());
        application.setUpdatedAt(LocalDateTime.now());

        Application saved = applicationRepository.save(application);
        log.info("Postulación creada: userId={}, jobId={}, applicationId={}", userId, jobId, saved.getId());

        Company company = companyRepository.findById(job.getCompanyId()).orElse(null);
        return mapToResponse(saved, user, job, company);
    }

    public ApplicationResponse getApplicationById(String id) {
        Application application = applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Postulación no encontrada con ID: " + id));
        return loadAndMapSingle(application);
    }

    public List<ApplicationResponse> getApplicationsByUser(String userId) {
        return mapList(applicationRepository.findByUserId(userId));
    }

    public List<ApplicationResponse> getApplicationsByJob(String jobId) {
        return mapList(applicationRepository.findByJobId(jobId));
    }

    public List<ApplicationResponse> getApplicationsByJob(String jobId, String requesterId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job no encontrado con ID: " + jobId));
        verifyJobOwnership(job, requesterId);
        return mapList(applicationRepository.findByJobId(jobId));
    }

    public List<ApplicationResponse> getApplicationsByCompany(String companyId) {
        return mapList(findByCompanyId(companyId));
    }

    public List<ApplicationResponse> getApplicationsByCompany(String companyId, String requesterId) {
        verifyCompanyOwnership(companyId, requesterId);
        return mapList(findByCompanyId(companyId));
    }

    public Page<ApplicationResponse> getApplicationsByCompany(String companyId, String requesterId, Pageable pageable) {
        verifyCompanyOwnership(companyId, requesterId);
        List<String> jobIds = jobRepository.findByCompanyId(companyId)
                .stream().map(Job::getId).collect(Collectors.toList());
        if (jobIds.isEmpty()) return Page.empty(pageable);

        Query query = new Query(Criteria.where("jobId").in(jobIds));
        long total = mongoTemplate.count(query, Application.class);
        List<Application> apps = mongoTemplate.find(query.with(pageable), Application.class);
        return new PageImpl<>(mapList(apps), pageable, total);
    }

    public List<ApplicationResponse> getApplicationsByStatus(String status) {
        return mapList(applicationRepository.findByStatus(ApplicationStatus.fromValue(status)));
    }

    public ApplicationResponse updateStatus(String id, String status, String notes, String requesterId) {
        Application application = applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Postulación no encontrada con ID: " + id));

        Job job = jobRepository.findById(application.getJobId())
                .orElseThrow(() -> new ResourceNotFoundException("Job no encontrado"));
        verifyJobOwnership(job, requesterId);

        ApplicationStatus appStatus = ApplicationStatus.fromValue(status);
        application.setStatus(appStatus);
        if (notes != null) application.setNotes(notes);
        if (appStatus != ApplicationStatus.PENDIENTE && application.getReviewedDate() == null) {
            application.setReviewedDate(LocalDateTime.now());
        }
        application.setUpdatedAt(LocalDateTime.now());

        Application updated = applicationRepository.save(application);
        log.info("Estado de postulación {} cambiado a '{}'", id, status);
        return loadAndMapSingle(updated);
    }

    public void deleteApplication(String id, String requesterId, boolean hasManagementPrivileges) {
        Application application = applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Postulación no encontrada con ID: " + id));

        boolean isOwner = application.getUserId().equals(requesterId);
        if (!hasManagementPrivileges && !isOwner) {
            throw new AccessDeniedException("No tienes permiso para eliminar esta postulación");
        }

        applicationRepository.delete(application);
        log.info("Postulación {} eliminada por usuario {}", id, requesterId);
    }

    public long countApplicationsByCompany(String companyId) {
        List<String> jobIds = jobRepository.findByCompanyId(companyId)
                .stream().map(Job::getId).collect(Collectors.toList());
        if (jobIds.isEmpty()) return 0L;
        return mongoTemplate.count(new Query(Criteria.where("jobId").in(jobIds)), Application.class);
    }

    public long countPendingApplicationsByCompany(String companyId) {
        List<String> jobIds = jobRepository.findByCompanyId(companyId)
                .stream().map(Job::getId).collect(Collectors.toList());
        if (jobIds.isEmpty()) return 0L;
        return mongoTemplate.count(
                new Query(Criteria.where("jobId").in(jobIds).and("status").is(ApplicationStatus.PENDIENTE)),
                Application.class);
    }

    public long countApplicationsByJob(String jobId) {
        long total = applicationRepository.countByJobId(jobId);
        log.debug("Total de postulaciones para job {}: {}", jobId, total);
        return total;
    }

    public boolean hasUserApplied(String userId, String jobId) {
        boolean exists = applicationRepository.existsByUserIdAndJobId(userId, jobId);
        log.debug("Usuario {} ya aplicado a job {}: {}", userId, jobId, exists);
        return exists;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private List<Application> findByCompanyId(String companyId) {
        List<String> jobIds = jobRepository.findByCompanyId(companyId)
                .stream().map(Job::getId).collect(Collectors.toList());
        if (jobIds.isEmpty()) return List.of();
        return applicationRepository.findByJobIdIn(jobIds);
    }

    private ApplicationResponse loadAndMapSingle(Application application) {
        User user = userRepository.findById(application.getUserId()).orElse(null);
        Job job = jobRepository.findById(application.getJobId()).orElse(null);
        Company company = job != null ? companyRepository.findById(job.getCompanyId()).orElse(null) : null;
        return mapToResponse(application, user, job, company);
    }

    private List<ApplicationResponse> mapList(List<Application> applications) {
        if (applications.isEmpty()) return List.of();
        Set<String> userIds = applications.stream().map(Application::getUserId).collect(Collectors.toSet());
        Set<String> jobIds = applications.stream().map(Application::getJobId).collect(Collectors.toSet());
        Map<String, User> userMap = userRepository.findAllById(userIds)
                .stream().collect(Collectors.toMap(User::getId, u -> u));
        Map<String, Job> jobMap = jobRepository.findAllById(jobIds)
                .stream().collect(Collectors.toMap(Job::getId, j -> j));
        Set<String> companyIds = jobMap.values().stream()
                .map(Job::getCompanyId).collect(Collectors.toSet());
        Map<String, Company> companyMap = companyRepository.findAllById(companyIds)
                .stream().collect(Collectors.toMap(Company::getId, c -> c));

        return applications.stream().map(app -> {
            User u = userMap.get(app.getUserId());
            Job j = jobMap.get(app.getJobId());
            Company c = j != null ? companyMap.get(j.getCompanyId()) : null;
            return mapToResponse(app, u, j, c);
        }).collect(Collectors.toList());
    }

    private void verifyJobOwnership(Job job, String requesterId) {
        Company company = companyRepository.findById(job.getCompanyId()).orElse(null);
        if (company == null || !requesterId.equals(company.getUserId())) {
            throw new AccessDeniedException("No tienes permiso para acceder a estas postulaciones");
        }
    }

    private void verifyCompanyOwnership(String companyId, String requesterId) {
        boolean isOwner = companyRepository.findById(companyId)
                .map(c -> requesterId.equals(c.getUserId()))
                .orElse(false);
        if (!isOwner) {
            throw new AccessDeniedException("No tienes permiso para acceder a esta empresa");
        }
    }

    private ApplicationResponse mapToResponse(Application app, User user, Job job, Company company) {
        ApplicationResponse response = new ApplicationResponse();
        response.setId(app.getId());
        if (user != null) {
            response.setUserId(user.getId());
            response.setUserName(user.getFirstName() + " " + user.getLastName());
            response.setUserEmail(user.getEmail());
            response.setUserPhone(user.getPhone());
            response.setUserHeadline(user.getHeadline());
            response.setUserLocation(user.getLocation());
            response.setUserProfileImageUrl(user.getProfileImageUrl());
        }
        if (job != null) {
            response.setJobId(job.getId());
            response.setJobTitle(job.getTitle());
        }
        if (company != null) {
            response.setCompanyName(company.getName());
        }
        response.setStatus(app.getStatus() != null ? app.getStatus().getValue() : null);
        response.setResume(app.getResume());
        response.setCoverLetter(app.getCoverLetter());
        response.setNotes(app.getNotes());
        response.setAppliedDate(app.getAppliedDate());
        response.setReviewedDate(app.getReviewedDate());
        response.setCreatedAt(app.getCreatedAt());
        response.setUpdatedAt(app.getUpdatedAt());
        return response;
    }
}
