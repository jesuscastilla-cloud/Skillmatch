package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.CertificationRequest;
import com.skillmatch.backend.dto.CertificationResponse;
import com.skillmatch.backend.model.Certification;
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
public class CertificationService {

    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    public List<CertificationResponse> getUserCertifications(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        return user.getCertifications().stream()
                .sorted(Comparator.comparing(Certification::getIssueDate,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public CertificationResponse addCertification(String userId, CertificationRequest request) {
        userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        Certification certification = new Certification();
        certification.setId(new ObjectId().toString());
        certification.setName(request.getName());
        certification.setIssuer(request.getIssuer());
        certification.setIssueDate(request.getIssueDate());
        certification.setExpirationDate(request.getExpirationDate());
        certification.setCredentialId(request.getCredentialId());
        certification.setCredentialUrl(request.getCredentialUrl());
        certification.setDescription(request.getDescription());
        certification.setCreatedAt(LocalDateTime.now());
        certification.setUpdatedAt(LocalDateTime.now());

        Query q = new Query(Criteria.where("_id").is(userId));
        Update u = new Update().push("certifications", certification);
        mongoTemplate.updateFirst(q, u, User.class);

        log.info("Certificación '{}' agregada para usuario {}", request.getName(), userId);
        return mapToResponse(certification);
    }

    public CertificationResponse updateCertification(String userId, String certificationId, CertificationRequest request) {
        if (certificationId == null) {
            throw new IllegalArgumentException("El ID de certificación no puede ser nulo");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        Certification existing = user.getCertifications().stream()
                .filter(c -> certificationId.equals(c.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Certificación no encontrada"));

        Query q = new Query(Criteria.where("_id").is(userId).and("certifications.id").is(certificationId));
        Update u = new Update()
                .set("certifications.$.name", request.getName())
                .set("certifications.$.issuer", request.getIssuer())
                .set("certifications.$.issueDate", request.getIssueDate())
                .set("certifications.$.expirationDate", request.getExpirationDate())
                .set("certifications.$.credentialId", request.getCredentialId())
                .set("certifications.$.credentialUrl", request.getCredentialUrl())
                .set("certifications.$.description", request.getDescription())
                .set("certifications.$.updatedAt", LocalDateTime.now());
        mongoTemplate.updateFirst(q, u, User.class);

        existing.setName(request.getName());
        existing.setIssuer(request.getIssuer());
        existing.setIssueDate(request.getIssueDate());
        existing.setExpirationDate(request.getExpirationDate());
        existing.setCredentialId(request.getCredentialId());
        existing.setCredentialUrl(request.getCredentialUrl());
        existing.setDescription(request.getDescription());

        log.info("Certificación {} actualizada para usuario {}", certificationId, userId);
        return mapToResponse(existing);
    }

    public void deleteCertification(String userId, String certificationId) {
        if (certificationId == null) {
            throw new IllegalArgumentException("El ID de certificación no puede ser nulo");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        boolean exists = user.getCertifications().stream().anyMatch(c -> certificationId.equals(c.getId()));
        if (!exists) {
            throw new IllegalArgumentException("Certificación no encontrada");
        }

        Query q = new Query(Criteria.where("_id").is(userId));
        Update u = new Update().pull("certifications", Query.query(Criteria.where("id").is(certificationId)));
        mongoTemplate.updateFirst(q, u, User.class);

        log.info("Certificación {} eliminada para usuario {}", certificationId, userId);
    }

    private CertificationResponse mapToResponse(Certification c) {
        return new CertificationResponse(
                c.getId(),
                c.getName(),
                c.getIssuer(),
                c.getIssueDate(),
                c.getExpirationDate(),
                c.getCredentialId(),
                c.getCredentialUrl(),
                c.getDescription(),
                c.getCreatedAt()
        );
    }
}
