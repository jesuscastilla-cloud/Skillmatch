package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.ExperienceRequest;
import com.skillmatch.backend.dto.ExperienceResponse;
import com.skillmatch.backend.model.Experience;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ExperienceService {

    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    public List<ExperienceResponse> getUserExperiences(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        return user.getExperiences().stream()
                .sorted(Comparator.comparing(Experience::getStartDate,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public ExperienceResponse addExperience(String userId, ExperienceRequest request) {
        if (userId == null) {
            throw new IllegalArgumentException("El ID de usuario no puede ser nulo");
        }
        userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        Experience experience = new Experience();
        experience.setId(new ObjectId().toString());
        experience.setCompany(request.getCompany());
        experience.setPosition(request.getPosition());
        experience.setStartDate(request.getStartDate());
        experience.setEndDate(request.getEndDate());
        experience.setIsCurrent(request.getIsCurrent() != null ? request.getIsCurrent() : false);
        experience.setDescription(request.getDescription());
        experience.setLocation(request.getLocation());
        experience.setCreatedAt(LocalDateTime.now());
        experience.setUpdatedAt(LocalDateTime.now());

        Query q = new Query(Criteria.where("_id").is(userId));
        Update u = new Update().push("experiences", experience);
        mongoTemplate.updateFirst(q, u, User.class);

        log.info("Experiencia en '{}' agregada para usuario {}", request.getCompany(), userId);
        return mapToResponse(experience);
    }

    public ExperienceResponse updateExperience(String userId, String experienceId, ExperienceRequest request) {
        if (experienceId == null) {
            throw new IllegalArgumentException("El ID de experiencia no puede ser nulo");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        Experience existing = user.getExperiences().stream()
                .filter(e -> experienceId.equals(e.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Experiencia no encontrada"));

        Query q = new Query(Criteria.where("_id").is(userId).and("experiences.id").is(experienceId));
        Update u = new Update()
                .set("experiences.$.company", request.getCompany())
                .set("experiences.$.position", request.getPosition())
                .set("experiences.$.startDate", request.getStartDate())
                .set("experiences.$.endDate", request.getEndDate())
                .set("experiences.$.isCurrent", request.getIsCurrent() != null ? request.getIsCurrent() : false)
                .set("experiences.$.description", request.getDescription())
                .set("experiences.$.location", request.getLocation())
                .set("experiences.$.updatedAt", LocalDateTime.now());
        mongoTemplate.updateFirst(q, u, User.class);

        existing.setCompany(request.getCompany());
        existing.setPosition(request.getPosition());
        existing.setStartDate(request.getStartDate());
        existing.setEndDate(request.getEndDate());
        existing.setIsCurrent(request.getIsCurrent() != null ? request.getIsCurrent() : false);
        existing.setDescription(request.getDescription());
        existing.setLocation(request.getLocation());

        log.info("Experiencia {} actualizada para usuario {}", experienceId, userId);
        return mapToResponse(existing);
    }

    public void deleteExperience(String userId, String experienceId) {
        if (experienceId == null) {
            throw new IllegalArgumentException("El ID de experiencia no puede ser nulo");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        boolean exists = user.getExperiences().stream().anyMatch(e -> experienceId.equals(e.getId()));
        if (!exists) {
            throw new IllegalArgumentException("Experiencia no encontrada");
        }

        Query q = new Query(Criteria.where("_id").is(userId));
        Update u = new Update().pull("experiences", Query.query(Criteria.where("id").is(experienceId)));
        mongoTemplate.updateFirst(q, u, User.class);

        log.info("Experiencia {} eliminada para usuario {}", experienceId, userId);
    }

    private ExperienceResponse mapToResponse(Experience e) {
        return new ExperienceResponse(
                e.getId(),
                e.getCompany(),
                e.getPosition(),
                e.getStartDate(),
                e.getEndDate(),
                e.getIsCurrent(),
                e.getDescription(),
                e.getLocation(),
                e.getCreatedAt()
        );
    }
}
