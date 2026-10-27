package com.skillmatch.backend.service;

import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.JobStatus;
import com.skillmatch.backend.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Plazos de retención (Ley 1581: los datos se guardan el tiempo razonable y
 * necesario; plazos aprobados el 27 de octubre de 2026):
 * - Postulaciones: se borran 12 meses después de cerrar la vacante (esta tarea).
 * - Notificaciones: 90 días, con un índice TTL (MongoIndexConfig).
 * - Cuentas sin entrar 24 meses: aviso por correo a los 23 y borrado 30 días después
 *   si no entra (cuentasInactivas). Sin correo configurado no se borra nada.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RetencionDatos {

    static final int MESES_POSTULACIONES = 12;
    static final int MESES_AVISO_INACTIVA = 23;
    static final int DIAS_ENTRE_AVISO_Y_BORRADO = 30;
    /** Avisos por día: el plan gratis de Brevo da 300 correos diarios y los códigos también cuentan. */
    static final int MAX_AVISOS_POR_DIA = 200;

    private final MongoTemplate mongoTemplate;
    private final CorreoService correo;
    private final DatosPersonalesService datosPersonales;
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

    /**
     * Cuentas sin entrar: a los 23 meses se avisa por correo; si en 30 días no entra,
     * se borra como "Eliminar mi cuenta". Sin correo configurado no se hace nada:
     * ninguna cuenta se borra sin aviso. Las cuentas ADMIN no se borran.
     */
    @Scheduled(cron = "0 0 4 * * *")
    public void cuentasInactivas() {
        if (!correo.configurado()) {
            log.info("Retención: correo no configurado, no se avisan ni se borran cuentas inactivas");
            return;
        }
        LocalDateTime ahora = LocalDateTime.now(clock);
        LocalDateTime limiteAviso = ahora.minusMonths(MESES_AVISO_INACTIVA);
        Criteria noAdmin = Criteria.where("roles").ne("ADMIN");

        // 1. Avisar
        Query porAvisar = new Query(new Criteria().andOperator(noAdmin,
                Criteria.where("avisoInactividadEn").is(null),
                new Criteria().orOperator(
                        Criteria.where("lastLoginAt").lt(limiteAviso),
                        new Criteria().andOperator(Criteria.where("lastLoginAt").is(null),
                                Criteria.where("createdAt").lt(limiteAviso)))))
                .limit(MAX_AVISOS_POR_DIA);
        int avisados = 0;
        for (User user : mongoTemplate.find(porAvisar, User.class)) {
            String fecha = ahora.plusDays(DIAS_ENTRE_AVISO_Y_BORRADO).format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
            boolean enviado = correo.enviar(user.getEmail(), "Tu cuenta de SkillMatch se eliminará el " + fecha,
                    "Hola " + user.getFirstName() + ",\n\n"
                    + "No has entrado a SkillMatch en casi dos años. Para no guardar datos que ya no usas, "
                    + "tu cuenta y tus datos se eliminarán el " + fecha + ".\n\n"
                    + "Si quieres conservarla, solo inicia sesión antes de esa fecha.");
            if (enviado) {
                mongoTemplate.updateFirst(new Query(Criteria.where("_id").is(user.getId())),
                        new Update().set("avisoInactividadEn", ahora), User.class);
                avisados++;
            }
        }

        // 2. Borrar las que se avisaron hace 30 días y no volvieron a entrar
        LocalDateTime limiteBorrado = ahora.minusDays(DIAS_ENTRE_AVISO_Y_BORRADO);
        List<User> porBorrar = mongoTemplate.find(new Query(new Criteria().andOperator(noAdmin,
                Criteria.where("avisoInactividadEn").lt(limiteBorrado))), User.class);
        for (User user : porBorrar) {
            datosPersonales.borrarDatos(user);
        }
        if (avisados + porBorrar.size() > 0) {
            log.info("Retención: {} cuentas inactivas avisadas, {} borradas", avisados, porBorrar.size());
        }
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }
}
