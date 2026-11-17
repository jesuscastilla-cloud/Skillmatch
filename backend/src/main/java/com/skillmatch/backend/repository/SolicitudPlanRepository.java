package com.skillmatch.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.skillmatch.backend.model.SolicitudPlan;

public interface SolicitudPlanRepository extends MongoRepository<SolicitudPlan, String> {
    List<SolicitudPlan> findByCompanyIdOrderByCreatedAtDesc(String companyId);
    Optional<SolicitudPlan> findFirstByCompanyIdAndEstado(String companyId, SolicitudPlan.Estado estado);
    List<SolicitudPlan> findByEstadoOrderByCreatedAtAsc(SolicitudPlan.Estado estado);
    List<SolicitudPlan> findTop50ByOrderByCreatedAtDesc();
}
