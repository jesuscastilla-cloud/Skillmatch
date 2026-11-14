package com.skillmatch.backend.repository;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.skillmatch.backend.model.PreferenciasCorreo;

public interface PreferenciasCorreoRepository extends MongoRepository<PreferenciasCorreo, String> {
}
