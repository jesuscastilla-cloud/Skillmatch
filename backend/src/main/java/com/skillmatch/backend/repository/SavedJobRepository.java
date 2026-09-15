package com.skillmatch.backend.repository;

import com.skillmatch.backend.model.SavedJob;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface SavedJobRepository extends MongoRepository<SavedJob, String> {

    List<SavedJob> findByUserIdOrderBySavedAtDesc(String userId);

    Optional<SavedJob> findByUserIdAndJobId(String userId, String jobId);

    boolean existsByUserIdAndJobId(String userId, String jobId);

    void deleteByUserIdAndJobId(String userId, String jobId);

    long countByUserId(String userId);

    List<SavedJob> findByUserId(String userId);
}
