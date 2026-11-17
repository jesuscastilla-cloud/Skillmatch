package com.skillmatch.backend.repository;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.skillmatch.backend.model.ConfiguracionComercial;

public interface ConfiguracionComercialRepository extends MongoRepository<ConfiguracionComercial, String> {
}
