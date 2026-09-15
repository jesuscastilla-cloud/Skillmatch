package com.skillmatch.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ApplicationStatus;

@Repository
public interface ApplicationRepository extends MongoRepository<Application, String> {

    List<Application> findByUserId(String userId);

    List<Application> findByJobId(String jobId);

    List<Application> findByJobIdIn(List<String> jobIds);

    List<Application> findByUserIdAndStatus(String userId, ApplicationStatus status);

    List<Application> findByJobIdAndStatus(String jobId, ApplicationStatus status);

    boolean existsByUserIdAndJobId(String userId, String jobId);

    Optional<Application> findByUserIdAndJobId(String userId, String jobId);

    long countByUserId(String userId);

    long countByJobId(String jobId);

    List<Application> findByUserIdOrderByAppliedDateDesc(String userId);

    List<Application> findByStatus(ApplicationStatus status);
}
