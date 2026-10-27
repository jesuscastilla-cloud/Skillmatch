package com.skillmatch.backend.repository;

import com.skillmatch.backend.model.CanjeGoogle;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface CanjeGoogleRepository extends MongoRepository<CanjeGoogle, String> {
}
