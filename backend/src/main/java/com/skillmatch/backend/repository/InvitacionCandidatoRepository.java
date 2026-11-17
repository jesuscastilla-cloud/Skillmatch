package com.skillmatch.backend.repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.skillmatch.backend.model.InvitacionCandidato;

public interface InvitacionCandidatoRepository extends MongoRepository<InvitacionCandidato, String> {
    List<InvitacionCandidato> findByInvitacionId(String invitacionId);
    List<InvitacionCandidato> findByInvitacionIdIn(Collection<String> invitacionIds);
    List<InvitacionCandidato> findByUserIdOrderByCreatedAtDesc(String userId);
    long countByCompanyIdAndCreatedAtGreaterThanEqual(String companyId, LocalDateTime desde);
    List<InvitacionCandidato> findByJobIdAndApplicationIdInAndEstadoIn(String jobId, Collection<String> applicationIds,
                                                                      Collection<InvitacionCandidato.Estado> estados);
    long countByInvitacionIdAndHorarioIdAndEstado(String invitacionId, String horarioId, InvitacionCandidato.Estado estado);
    List<InvitacionCandidato> findByEstadoAndCreatedAtBefore(InvitacionCandidato.Estado estado, LocalDateTime antes);
}
