package com.skillmatch.backend.repository;

import com.skillmatch.backend.model.CodigoCorreo;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface CodigoCorreoRepository extends MongoRepository<CodigoCorreo, String> {
}
