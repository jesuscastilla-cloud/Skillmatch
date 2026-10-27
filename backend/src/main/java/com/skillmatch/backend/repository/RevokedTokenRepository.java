package com.skillmatch.backend.repository;

import com.skillmatch.backend.model.RevokedToken;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface RevokedTokenRepository extends MongoRepository<RevokedToken, String> {
}
