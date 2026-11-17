package com.skillmatch.backend.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.skillmatch.backend.model.PlanEmpresa;

public interface PlanEmpresaRepository extends MongoRepository<PlanEmpresa, String> {
    List<PlanEmpresa> findByVigenteHastaAfterOrderByVigenteHastaAsc(LocalDateTime fecha);
}
