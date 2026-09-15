package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.EducationRequest;
import com.skillmatch.backend.dto.EducationResponse;
import com.skillmatch.backend.model.Education;
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
public class EducationService {

    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    public List<EducationResponse> getUserEducations(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        return user.getEducations().stream()
                .sorted(Comparator.comparing(Education::getStartDate,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public EducationResponse addEducation(String userId, EducationRequest request) {
        userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        Education education = new Education();
        education.setId(new ObjectId().toString());
        education.setSchool(request.getSchool());
        education.setDegree(request.getDegree());
        education.setFieldOfStudy(request.getFieldOfStudy());
        education.setStartDate(request.getStartDate());
        education.setEndDate(request.getEndDate());
        education.setIsCurrent(request.getIsCurrent() != null ? request.getIsCurrent() : false);
        education.setDescription(request.getDescription());
        education.setCreatedAt(LocalDateTime.now());
        education.setUpdatedAt(LocalDateTime.now());

        Query q = new Query(Criteria.where("_id").is(userId));
        Update u = new Update().push("educations", education);
        mongoTemplate.updateFirst(q, u, User.class);

        log.info("Educación en '{}' agregada para usuario {}", request.getSchool(), userId);
        return mapToResponse(education);
    }

    public EducationResponse updateEducation(String userId, String educationId, EducationRequest request) {
        if (educationId == null) {
            throw new IllegalArgumentException("El ID de educación no puede ser nulo");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        Education existing = user.getEducations().stream()
                .filter(e -> educationId.equals(e.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Educación no encontrada"));

        Query q = new Query(Criteria.where("_id").is(userId).and("educations.id").is(educationId));
        Update u = new Update()
                .set("educations.$.school", request.getSchool())
                .set("educations.$.degree", request.getDegree())
                .set("educations.$.fieldOfStudy", request.getFieldOfStudy())
                .set("educations.$.startDate", request.getStartDate())
                .set("educations.$.endDate", request.getEndDate())
                .set("educations.$.isCurrent", request.getIsCurrent() != null ? request.getIsCurrent() : false)
                .set("educations.$.description", request.getDescription())
                .set("educations.$.updatedAt", LocalDateTime.now());
        mongoTemplate.updateFirst(q, u, User.class);

        existing.setSchool(request.getSchool());
        existing.setDegree(request.getDegree());
        existing.setFieldOfStudy(request.getFieldOfStudy());
        existing.setStartDate(request.getStartDate());
        existing.setEndDate(request.getEndDate());
        existing.setIsCurrent(request.getIsCurrent() != null ? request.getIsCurrent() : false);
        existing.setDescription(request.getDescription());

        log.info("Educación {} actualizada para usuario {}", educationId, userId);
        return mapToResponse(existing);
    }

    public void deleteEducation(String userId, String educationId) {
        if (educationId == null) {
            throw new IllegalArgumentException("El ID de educación no puede ser nulo");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        boolean exists = user.getEducations().stream().anyMatch(e -> educationId.equals(e.getId()));
        if (!exists) {
            throw new IllegalArgumentException("Educación no encontrada");
        }

        Query q = new Query(Criteria.where("_id").is(userId));
        Update u = new Update().pull("educations", Query.query(Criteria.where("id").is(educationId)));
        mongoTemplate.updateFirst(q, u, User.class);

        log.info("Educación {} eliminada para usuario {}", educationId, userId);
    }

    private EducationResponse mapToResponse(Education e) {
        return new EducationResponse(
                e.getId(),
                e.getSchool(),
                e.getDegree(),
                e.getFieldOfStudy(),
                e.getStartDate(),
                e.getEndDate(),
                e.getIsCurrent(),
                e.getDescription(),
                e.getCreatedAt()
        );
    }
}
