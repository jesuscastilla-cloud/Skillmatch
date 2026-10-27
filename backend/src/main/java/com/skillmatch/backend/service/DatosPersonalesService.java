package com.skillmatch.backend.service;

import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Connection;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.JobStatus;
import com.skillmatch.backend.model.Message;
import com.skillmatch.backend.model.Notification;
import com.skillmatch.backend.model.SavedJob;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.NotificationRepository;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Derechos de la persona sobre sus datos (Ley 1581): conocerlos (exportar)
 * y suprimirlos (borrar la cuenta).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class DatosPersonalesService {

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final NotificationRepository notificationRepository;
    private final UserService userService;
    private final ApplicationService applicationService;
    private final SavedJobService savedJobService;
    private final MongoTemplate mongoTemplate;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptService loginAttemptService;

    /**
     * Todo lo que SkillMatch guarda de una persona, para "Descargar mis datos".
     * No incluye el hash de la contraseña ni la versión de sesiones, ni las notas
     * internas de las empresas sobre sus postulaciones.
     */
    public Map<String, Object> exportar(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));

        Map<String, Object> datos = new LinkedHashMap<>();
        datos.put("generadoEl", LocalDateTime.now());
        datos.put("perfil", userService.getUserProfile(userId));
        datos.put("roles", user.getRoles());
        datos.put("habilidades", user.getSkills());
        datos.put("experiencias", user.getExperiences());
        datos.put("estudios", user.getEducations());
        datos.put("certificaciones", user.getCertifications());
        datos.put("consentimientos", user.getConsentimientos());
        datos.put("postulaciones", applicationService.getApplicationsByUser(userId));
        datos.put("vacantesGuardadas", savedJobService.getUserSavedJobs(userId));
        datos.put("conexiones", mongoTemplate.find(new Query(new Criteria().orOperator(
                Criteria.where("userId").is(userId), Criteria.where("connectedUserId").is(userId))), Connection.class));
        datos.put("mensajes", mongoTemplate.find(new Query(new Criteria().orOperator(
                        Criteria.where("senderId").is(userId).and("deletedBySender").is(false),
                        Criteria.where("receiverId").is(userId).and("deletedByReceiver").is(false)))
                .with(Sort.by(Sort.Direction.ASC, "sentAt")), Message.class));
        datos.put("notificaciones", notificationRepository.findByUserIdOrderByCreatedAtDesc(userId));
        companyRepository.findByUserId(userId).ifPresent(c -> datos.put("empresa", empresa(c)));

        log.info("Exportación de datos personales para usuario {}", userId);
        return datos;
    }

    /**
     * "Eliminar mi cuenta" (derecho a suprimir, Ley 1581). Pide la contraseña actual.
     *
     * Borra postulaciones, vacantes guardadas, conexiones, TODOS los mensajes (enviados
     * y recibidos), sus notificaciones y las de otras personas que la mencionan, y la
     * cuenta. Si es empresa, cierra sus vacantes y deja la empresa anónima ("Empresa
     * eliminada"): las postulaciones a esas vacantes siguen en el historial de cada persona.
     */
    public void borrarCuenta(String userId, String claveActual) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));

        // Igual que el cambio de contraseña: cuenta para el bloqueo por intentos fallidos
        loginAttemptService.checkNotLocked(user.getEmail());
        if (claveActual == null || !passwordEncoder.matches(claveActual, user.getPassword())) {
            loginAttemptService.recordFailure(user.getEmail());
            throw new IllegalArgumentException("La contraseña no es correcta");
        }
        borrarDatos(user);
        log.info("Cuenta {} eliminada por su titular", userId);
    }

    /**
     * Lo que borra "Eliminar mi cuenta", sin pedir contraseña. Lo usan la persona
     * (con su contraseña) y el borrado de cuentas inactivas (RetencionDatos).
     */
    void borrarDatos(User user) {
        String userId = user.getId();
        companyRepository.findByUserId(userId).ifPresent(this::anonimizarEmpresa);

        // Las notificaciones de OTRAS personas que la mencionan ("Ana te envió un mensaje")
        // apuntan al mensaje o a la conexión por relatedId: se juntan antes de borrar
        Criteria susConexiones = new Criteria().orOperator(
                Criteria.where("userId").is(userId), Criteria.where("connectedUserId").is(userId));
        Criteria susMensajes = new Criteria().orOperator(
                Criteria.where("senderId").is(userId), Criteria.where("receiverId").is(userId));
        List<String> relacionados = new ArrayList<>();
        mongoTemplate.find(new Query(susConexiones), Connection.class).forEach(c -> relacionados.add(c.getId()));
        mongoTemplate.find(new Query(susMensajes), Message.class).forEach(m -> relacionados.add(m.getId()));

        mongoTemplate.remove(new Query(new Criteria().orOperator(
                Criteria.where("userId").is(userId),
                Criteria.where("relatedId").in(relacionados),
                Criteria.where("actionUrl").regex(Pattern.quote(userId)))), Notification.class);
        mongoTemplate.remove(new Query(susMensajes), Message.class);
        mongoTemplate.remove(new Query(susConexiones), Connection.class);
        mongoTemplate.remove(new Query(Criteria.where("userId").is(userId)), Application.class);
        mongoTemplate.remove(new Query(Criteria.where("userId").is(userId)), SavedJob.class);
        loginAttemptService.reset(user.getEmail());
        userRepository.delete(user);
    }

    private void anonimizarEmpresa(Company company) {
        mongoTemplate.updateMulti(new Query(Criteria.where("companyId").is(company.getId())),
                new Update().set("active", false).set("status", JobStatus.CERRADA).set("updatedAt", LocalDateTime.now()),
                Job.class);
        company.setName("Empresa eliminada");
        company.setEmail(null);
        company.setPhone(null);
        company.setWebsite(null);
        company.setLogo(null);
        company.setDescription(null);
        company.setBenefits(null);
        company.setUserId(null);
        company.setActive(false);
        company.setUpdatedAt(LocalDateTime.now());
        companyRepository.save(company);
    }

    private Map<String, Object> empresa(Company c) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("id", c.getId());
        e.put("name", c.getName());
        e.put("email", c.getEmail());
        e.put("phone", c.getPhone());
        e.put("description", c.getDescription());
        e.put("industry", c.getIndustry());
        e.put("size", c.getSize());
        e.put("location", c.getLocation());
        e.put("website", c.getWebsite());
        e.put("createdAt", c.getCreatedAt());
        return e;
    }
}
