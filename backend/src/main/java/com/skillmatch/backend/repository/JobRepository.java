package com.skillmatch.backend.repository;

import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.JobStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface JobRepository extends MongoRepository<Job, String> {

    List<Job> findByCompanyId(String companyId);

    List<Job> findByCompanyIdAndActiveTrue(String companyId);

    long countByCompanyId(String companyId);

    long countByCompanyIdAndActiveTrueAndStatus(String companyId, JobStatus status);

    List<Job> findByActiveTrueAndExpirationDateBefore(LocalDateTime date);

    long countByActiveTrue();
}
