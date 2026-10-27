package com.skillmatch.backend.service;

import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Connection;
import com.skillmatch.backend.model.Message;
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
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

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
