package com.skillmatch.backend.service;

import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.JobStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Plazos de retención (Ley 1581: los datos se guardan el tiempo razonable y
 * necesario; plazos aprobados el 27 de octubre de 2026):
 * - Postulaciones: se borran 12 meses después de cerrar la vacante (esta tarea).
 * - Notificaciones: 90 días, con un índice TTL (MongoIndexConfig).
 * - Cuentas sin entrar 24 meses: se guarda lastLoginAt desde ahora; el borrado se
 *   activa cuando haya envío de correos para avisar antes (fase 8).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RetencionDatos {

    static final int MESES_POSTULACIONES = 12;

    private final MongoTemplate mongoTemplate;
    private Clock clock = Clock.systemDefaultZone();

    /** Todos los días a las 3 a. m. */
    @Scheduled(cron = "0 0 3 * * *")
    public void borrarPostulacionesViejas() {
        LocalDateTime limite = LocalDateTime.now(clock).minusMonths(MESES_POSTULACIONES);
        List<String> vacantes = mongoTemplate.find(new Query(Criteria.where("status").is(JobStatus.CERRADA)
                        .and("updatedAt").lt(limite)), Job.class).stream()
                .map(Job::getId)
                .toList();
        if (vacantes.isEmpty()) return;

        long borradas = mongoTemplate.remove(new Query(Criteria.where("jobId").in(vacantes)), Application.class)
                .getDeletedCount();
        if (borradas > 0) {
            log.info("Retención: {} postulaciones borradas (vacantes cerradas hace más de {} meses)",
                    borradas, MESES_POSTULACIONES);
        }
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }
}
