package com.skillmatch.backend.repository;

import com.skillmatch.backend.model.LoginAttempt;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface LoginAttemptRepository extends MongoRepository<LoginAttempt, String> {
}
