package com.skillmatch.backend.repository;

import com.skillmatch.backend.model.RegistroPendiente;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface RegistroPendienteRepository extends MongoRepository<RegistroPendiente, String> {
}
