package com.skillmatch.backend.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.skillmatch.backend.model.Invitacion;

public interface InvitacionRepository extends MongoRepository<Invitacion, String> {
    List<Invitacion> findByCompanyIdOrderByCreatedAtDesc(String companyId);
    List<Invitacion> findByCompanyIdAndEstado(String companyId, Invitacion.Estado estado);
}
