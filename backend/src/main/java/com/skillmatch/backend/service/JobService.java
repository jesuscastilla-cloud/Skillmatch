package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.JobRequest;
import com.skillmatch.backend.dto.JobResponse;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.JobStatus;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class JobService {

    private final JobRepository jobRepository;
    private final CompanyRepository companyRepository;
    private final MongoTemplate mongoTemplate;

    public JobResponse createJob(JobRequest request) {
        String companyId = request.getCompanyId();
        if (companyId == null) throw new RuntimeException("El ID de la compañía no puede ser nulo");
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Compañía no encontrada con ID: " + companyId));

        validateSalaryRange(request);

        Job job = buildJobFromRequest(new Job(), request);
        job.setCompanyId(companyId);
        job.setStatus(JobStatus.ABIERTA);
        job.setActive(true);
        job.setPostedDate(LocalDateTime.now());
        job.setCreatedAt(LocalDateTime.now());
        job.setUpdatedAt(LocalDateTime.now());

        log.info("Oferta '{}' creada para empresa {}", request.getTitle(), companyId);
        return mapToResponse(jobRepository.save(job), company);
    }

    public JobResponse updateJob(String id, JobRequest request, String requesterId) {
        Job job = findJobOrThrow(id);
        verifyOwnership(job, requesterId);
        validateSalaryRange(request);
        buildJobFromRequest(job, request);
        job.setUpdatedAt(LocalDateTime.now());
        Company company = companyRepository.findById(job.getCompanyId()).orElse(null);
        return mapToResponse(jobRepository.save(job), company);
    }

    public JobResponse changeStatus(String id, String status, String requesterId) {
        Job job = findJobOrThrow(id);
        verifyOwnership(job, requesterId);
        JobStatus jobStatus = JobStatus.fromValue(status);
        job.setStatus(jobStatus);
        job.setActive(jobStatus != JobStatus.CERRADA);
        job.setUpdatedAt(LocalDateTime.now());
        Company company = companyRepository.findById(job.getCompanyId()).orElse(null);
        return mapToResponse(jobRepository.save(job), company);
    }

    public void deleteJob(String id, String requesterId) {
        Job job = findJobOrThrow(id);
        verifyOwnership(job, requesterId);
        job.setActive(false);
        job.setStatus(JobStatus.CERRADA);
        job.setUpdatedAt(LocalDateTime.now());
        jobRepository.save(job);
    }

    public JobResponse getJobById(String id) {
        Job job = findJobOrThrow(id);
        Company company = companyRepository.findById(job.getCompanyId()).orElse(null);
        return mapToResponse(job, company);
    }

    public Page<JobResponse> getAllActiveJobs(Pageable pageable) {
        Query query = new Query(Criteria.where("active").is(true).and("status").is(JobStatus.ABIERTA));
        return executePagedQuery(query, pageable);
    }

    public Page<JobResponse> searchJobs(String keyword, Pageable pageable) {
        if (keyword == null || keyword.isBlank()) return getAllActiveJobs(pageable);
        Criteria criteria = Criteria.where("active").is(true)
                .orOperator(
                        Criteria.where("title").regex(keyword, "i"),
                        Criteria.where("description").regex(keyword, "i")
                );
        return executePagedQuery(new Query(criteria), pageable);
    }

    public Page<JobResponse> getJobsByFilters(String type, String modality,
                                               String experienceLevel, String location,
                                               Double minSalary, Double maxSalary,
                                               Pageable pageable) {
        List<Criteria> conditions = new ArrayList<>();
        conditions.add(Criteria.where("active").is(true));
        conditions.add(Criteria.where("status").is(JobStatus.ABIERTA));
        if (type != null && !type.isBlank()) conditions.add(Criteria.where("type").is(type));
        if (modality != null && !modality.isBlank()) conditions.add(Criteria.where("modality").is(modality));
        if (experienceLevel != null && !experienceLevel.isBlank()) conditions.add(Criteria.where("experienceLevel").is(experienceLevel));
        if (location != null && !location.isBlank()) conditions.add(Criteria.where("location").regex(location, "i"));
        if (minSalary != null) conditions.add(Criteria.where("salaryMax").gte(minSalary));
        if (maxSalary != null) conditions.add(Criteria.where("salaryMin").lte(maxSalary));
        Criteria criteria = new Criteria().andOperator(conditions.toArray(new Criteria[0]));
        return executePagedQuery(new Query(criteria), pageable);
    }

    public List<JobResponse> getRecentJobs() {
        Query q = new Query(Criteria.where("active").is(true).and("status").is(JobStatus.ABIERTA))
                .with(Sort.by(Sort.Direction.DESC, "postedDate"))
                .limit(10);
        return mapWithBatchCompanies(mongoTemplate.find(q, Job.class));
    }

    public List<JobResponse> getJobsByCompany(String companyId) {
        List<Job> jobs = jobRepository.findByCompanyId(companyId);
        Company company = companyRepository.findById(companyId).orElse(null);
        return jobs.stream().map(j -> mapToResponse(j, company)).collect(Collectors.toList());
    }

    public long countJobsByCompany(String companyId) {
        return jobRepository.countByCompanyId(companyId);
    }

    public long countActiveJobsByCompany(String companyId) {
        return jobRepository.countByCompanyIdAndActiveTrueAndStatus(companyId, JobStatus.ABIERTA);
    }

    @Scheduled(cron = "0 0 2 * * *")
    public void closeExpiredJobs() {
        List<Job> expired = jobRepository.findByActiveTrueAndExpirationDateBefore(LocalDateTime.now());
        if (expired.isEmpty()) return;
        expired.forEach(job -> {
            job.setStatus(JobStatus.CERRADA);
            job.setActive(false);
            job.setUpdatedAt(LocalDateTime.now());
        });
        jobRepository.saveAll(expired);
        log.info("Scheduler: {} oferta(s) expirada(s) cerrada(s) automáticamente", expired.size());
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Page<JobResponse> executePagedQuery(Query query, Pageable pageable) {
        long total = mongoTemplate.count(query, Job.class);
        List<Job> jobs = mongoTemplate.find(query.with(pageable), Job.class);
        return new PageImpl<>(mapWithBatchCompanies(jobs), pageable, total);
    }

    private List<JobResponse> mapWithBatchCompanies(List<Job> jobs) {
        Set<String> ids = jobs.stream().map(Job::getCompanyId).collect(Collectors.toSet());
        Map<String, Company> companyMap = companyRepository.findAllById(ids)
                .stream().collect(Collectors.toMap(Company::getId, c -> c));
        return jobs.stream()
                .map(j -> mapToResponse(j, companyMap.get(j.getCompanyId())))
                .collect(Collectors.toList());
    }

    private void verifyOwnership(Job job, String requesterId) {
        Company company = companyRepository.findById(job.getCompanyId()).orElse(null);
        if (company == null || !requesterId.equals(company.getUserId())) {
            throw new AccessDeniedException("No tienes permiso para modificar esta oferta");
        }
    }

    private Job findJobOrThrow(String id) {
        if (id == null) throw new RuntimeException("El ID del job no puede ser nulo");
        return jobRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Job no encontrado con ID: " + id));
    }

    private void validateSalaryRange(JobRequest request) {
        if (request.getSalaryMin() != null && request.getSalaryMax() != null
                && request.getSalaryMin() > request.getSalaryMax()) {
            throw new RuntimeException("El salario mínimo no puede ser mayor al salario máximo");
        }
    }

    private Job buildJobFromRequest(Job job, JobRequest request) {
        job.setTitle(request.getTitle());
        job.setDescription(request.getDescription());
        job.setType(request.getType());
        job.setExperienceLevel(request.getExperienceLevel());
        job.setSalaryMin(request.getSalaryMin());
        job.setSalaryMax(request.getSalaryMax());
        job.setLocation(request.getLocation());
        job.setModality(request.getModality());
        job.setDuration(request.getDuration());
        job.setRequirements(request.getRequirements());
        job.setResponsibilities(request.getResponsibilities());
        job.setSkills(request.getSkills());
        job.setBenefits(request.getBenefits());
        job.setExpirationDate(request.getExpirationDate());
        return job;
    }

    private JobResponse mapToResponse(Job job, Company company) {
        JobResponse response = new JobResponse();
        response.setId(job.getId());
        response.setCompanyId(job.getCompanyId());
        if (company != null) {
            response.setCompanyName(company.getName());
            response.setCompanyLogo(company.getLogo());
        }
        response.setTitle(job.getTitle());
        response.setDescription(job.getDescription());
        response.setType(job.getType());
        response.setExperienceLevel(job.getExperienceLevel());
        response.setSalaryMin(job.getSalaryMin());
        response.setSalaryMax(job.getSalaryMax());
        response.setLocation(job.getLocation());
        response.setModality(job.getModality());
        response.setDuration(job.getDuration());
        response.setRequirements(job.getRequirements());
        response.setResponsibilities(job.getResponsibilities());
        response.setSkills(job.getSkills());
        response.setBenefits(job.getBenefits());
        response.setStatus(job.getStatus() != null ? job.getStatus().getValue() : null);
        response.setPostedDate(job.getPostedDate());
        response.setExpirationDate(job.getExpirationDate());
        response.setActive(job.getActive());
        response.setCreatedAt(job.getCreatedAt());
        response.setUpdatedAt(job.getUpdatedAt());
        return response;
    }
}
