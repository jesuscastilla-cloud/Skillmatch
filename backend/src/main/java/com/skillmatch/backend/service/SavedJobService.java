package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.SavedJobRequest;
import com.skillmatch.backend.dto.SavedJobResponse;
import com.skillmatch.backend.exception.DuplicateResourceException;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.SavedJob;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.JobRepository;
import com.skillmatch.backend.repository.SavedJobRepository;
import com.skillmatch.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
public class SavedJobService {

    private final SavedJobRepository savedJobRepository;
    private final UserRepository userRepository;
    private final JobRepository jobRepository;
    private final CompanyRepository companyRepository;

    public SavedJobResponse saveJob(String userId, SavedJobRequest request) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Usuario no encontrado");
        }
        String jobId = request.getJobId();
        if (!jobRepository.existsById(jobId)) {
            throw new ResourceNotFoundException("Oferta de trabajo no encontrada");
        }
        if (savedJobRepository.existsByUserIdAndJobId(userId, jobId)) {
            throw new DuplicateResourceException("Esta oferta ya está guardada");
        }

        SavedJob savedJob = new SavedJob();
        savedJob.setUserId(userId);
        savedJob.setJobId(jobId);
        savedJob.setNotes(request.getNotes());
        savedJob.setSavedAt(LocalDateTime.now());

        savedJob = savedJobRepository.save(savedJob);
        log.info("Trabajo {} guardado por usuario {}", jobId, userId);

        Job job = jobRepository.findById(jobId).orElse(null);
        Company company = job != null ? companyRepository.findById(job.getCompanyId()).orElse(null) : null;
        return mapToResponse(savedJob, job, company);
    }

    public void unsaveJob(String userId, String jobId) {
        if (!savedJobRepository.existsByUserIdAndJobId(userId, jobId)) {
            throw new ResourceNotFoundException("Esta oferta no está guardada");
        }
        savedJobRepository.deleteByUserIdAndJobId(userId, jobId);
        log.info("Trabajo {} removido de guardados de usuario {}", jobId, userId);
    }

    public List<SavedJobResponse> getUserSavedJobs(String userId) {
        List<SavedJob> savedJobs = savedJobRepository.findByUserIdOrderBySavedAtDesc(userId);
        if (savedJobs.isEmpty()) return List.of();

        Set<String> jobIds = savedJobs.stream().map(SavedJob::getJobId).collect(Collectors.toSet());
        Map<String, Job> jobMap = jobRepository.findAllById(jobIds)
                .stream().collect(Collectors.toMap(Job::getId, j -> j));
        Set<String> companyIds = jobMap.values().stream()
                .map(Job::getCompanyId).collect(Collectors.toSet());
        Map<String, Company> companyMap = companyRepository.findAllById(companyIds)
                .stream().collect(Collectors.toMap(Company::getId, c -> c));

        return savedJobs.stream()
                .map(sj -> {
                    Job job = jobMap.get(sj.getJobId());
                    Company company = job != null ? companyMap.get(job.getCompanyId()) : null;
                    return mapToResponse(sj, job, company);
                })
                .collect(Collectors.toList());
    }

    public boolean isJobSaved(String userId, String jobId) {
        return savedJobRepository.existsByUserIdAndJobId(userId, jobId);
    }

    public List<String> getSavedJobIds(String userId) {
        return savedJobRepository.findByUserId(userId).stream()
                .map(SavedJob::getJobId)
                .collect(Collectors.toList());
    }

    public long getSavedJobsCount(String userId) {
        return savedJobRepository.countByUserId(userId);
    }

    public SavedJobResponse updateNotes(String userId, String jobId, String notes) {
        SavedJob savedJob = savedJobRepository.findByUserIdAndJobId(userId, jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Esta oferta no está guardada"));
        savedJob.setNotes(notes);
        savedJob = savedJobRepository.save(savedJob);

        Job job = jobRepository.findById(savedJob.getJobId()).orElse(null);
        Company company = job != null ? companyRepository.findById(job.getCompanyId()).orElse(null) : null;
        return mapToResponse(savedJob, job, company);
    }

    private SavedJobResponse mapToResponse(SavedJob savedJob, Job job, Company company) {
        SavedJobResponse response = new SavedJobResponse();
        response.setId(savedJob.getId());
        response.setUserId(savedJob.getUserId());
        if (job != null) {
            response.setJobId(job.getId());
            response.setJobTitle(job.getTitle());
            response.setJobType(job.getType());
            response.setLocation(job.getLocation());
            if (job.getSalaryMin() != null && job.getSalaryMax() != null) {
                response.setSalaryRange("$" + job.getSalaryMin() + " - $" + job.getSalaryMax());
            }
        }
        if (company != null) {
            response.setCompanyName(company.getName());
        }
        response.setSavedAt(savedJob.getSavedAt());
        response.setNotes(savedJob.getNotes());
        return response;
    }
}
