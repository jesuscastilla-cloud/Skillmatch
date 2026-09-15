package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.SkillRequest;
import com.skillmatch.backend.model.Skill;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class SkillService {

    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    public List<Map<String, Object>> getUserSkills(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        return user.getSkills().stream()
                .map(this::mapSkillToResponse)
                .collect(Collectors.toList());
    }

    public Map<String, Object> addSkill(String userId, SkillRequest request) {
        if (userId == null) {
            throw new IllegalArgumentException("El ID de usuario no puede ser nulo");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        boolean skillExists = user.getSkills().stream()
                .anyMatch(s -> s.getName().equalsIgnoreCase(request.getName()));
        if (skillExists) {
            throw new IllegalArgumentException("Esta habilidad ya existe en tu perfil");
        }

        Skill skill = new Skill();
        skill.setId(new ObjectId().toString());
        skill.setName(request.getName());
        skill.setLevel(request.getLevel());
        skill.setCreatedAt(LocalDateTime.now());
        skill.setUpdatedAt(LocalDateTime.now());

        Query q = new Query(Criteria.where("_id").is(userId));
        Update u = new Update().push("skills", skill);
        mongoTemplate.updateFirst(q, u, User.class);

        log.info("Habilidad '{}' agregada para usuario {}", request.getName(), userId);
        return mapSkillToResponse(skill);
    }

    public Map<String, Object> updateSkill(String userId, String skillId, SkillRequest request) {
        if (skillId == null) {
            throw new IllegalArgumentException("El ID de habilidad no puede ser nulo");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        Skill existing = user.getSkills().stream()
                .filter(s -> skillId.equals(s.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Habilidad no encontrada"));

        boolean duplicateExists = user.getSkills().stream()
                .anyMatch(s -> !s.getId().equals(skillId) &&
                               s.getName().equalsIgnoreCase(request.getName()));
        if (duplicateExists) {
            throw new IllegalArgumentException("Ya existe otra habilidad con este nombre");
        }

        Query q = new Query(Criteria.where("_id").is(userId).and("skills.id").is(skillId));
        Update u = new Update()
                .set("skills.$.name", request.getName())
                .set("skills.$.level", request.getLevel())
                .set("skills.$.updatedAt", LocalDateTime.now());
        mongoTemplate.updateFirst(q, u, User.class);

        existing.setName(request.getName());
        existing.setLevel(request.getLevel());
        log.info("Habilidad {} actualizada para usuario {}", skillId, userId);
        return mapSkillToResponse(existing);
    }

    public void deleteSkill(String userId, String skillId) {
        if (skillId == null) {
            throw new IllegalArgumentException("El ID de habilidad no puede ser nulo");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        boolean exists = user.getSkills().stream().anyMatch(s -> skillId.equals(s.getId()));
        if (!exists) {
            throw new IllegalArgumentException("Habilidad no encontrada");
        }

        Query q = new Query(Criteria.where("_id").is(userId));
        Update u = new Update().pull("skills", Query.query(Criteria.where("id").is(skillId)));
        mongoTemplate.updateFirst(q, u, User.class);

        log.info("Habilidad {} eliminada para usuario {}", skillId, userId);
    }

    private Map<String, Object> mapSkillToResponse(Skill skill) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", skill.getId());
        response.put("name", skill.getName());
        response.put("level", skill.getLevel());
        if (skill.getYearsOfExperience() != null) {
            response.put("yearsOfExperience", skill.getYearsOfExperience());
        }
        if (skill.getDescription() != null) {
            response.put("description", skill.getDescription());
        }
        response.put("createdAt", skill.getCreatedAt());
        return response;
    }
}
