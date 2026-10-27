package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.UpdatePasswordRequest;
import com.skillmatch.backend.dto.UpdateProfileRequest;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.ApplicationRepository;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.validation.Credenciales;
import com.skillmatch.backend.validation.EntradaSegura;
import com.skillmatch.backend.validation.Telefonos;
import com.skillmatch.backend.validation.ValidadorCorreo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final CompanyService companyService;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationRepository applicationRepository;
    private final MongoTemplate mongoTemplate;
    private final LoginAttemptService loginAttemptService;
    private final ValidadorCorreo validadorCorreo;

    @SuppressWarnings("null")
    public User getUserById(String id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado con id: " + id));
    }

    public User getUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("El email no puede estar vacío");
        }
        return userRepository.findByEmail(Credenciales.normalizarCorreo(email))
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado con email: " + email));
    }

    public User updateProfile(String userId, UpdateProfileRequest request) {
        User user = getUserById(userId);

        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null) user.setLastName(request.getLastName());
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (!validadorCorreo.puedeRecibir(request.getEmail())) {
                throw new IllegalArgumentException(ValidadorCorreo.MENSAJE);
            }
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new IllegalArgumentException("El email ya está en uso");
            }
            user.setEmail(request.getEmail());
            companyService.syncOwnerEmail(userId, request.getEmail());
        }
        if (request.getPhone() != null) {
            // Vacío lo quita; si cambia, deja de estar verificado y no puede ser el de otra cuenta
            String telefono = Telefonos.normalizarOpcional(request.getPhone());
            if (telefono != null && userRepository.existsByPhoneAndIdNot(telefono, userId)) {
                throw new IllegalArgumentException("Ese número ya está en otra cuenta.");
            }
            if (telefono == null || !telefono.equals(user.getPhone())) user.setPhoneVerified(null);
            user.setPhone(telefono);
        }
        if (request.getHeadline() != null) user.setHeadline(request.getHeadline());
        if (request.getLocation() != null) user.setLocation(request.getLocation());
        if (request.getBio() != null) user.setBio(request.getBio());

        user.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);
        log.info("Perfil actualizado para usuario {}", userId);
        return saved;
    }

    public User updateProfileImage(String userId, String imageUrl) {
        if (imageUrl == null || imageUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("La URL de la imagen de perfil es obligatoria");
        }
        if (!EntradaSegura.esImagenValida(imageUrl)) {
            throw new IllegalArgumentException("La imagen no es válida. Súbela de nuevo desde el editor de foto.");
        }
        User user = getUserById(userId);
        user.setProfileImageUrl(imageUrl);
        user.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);
        log.info("Imagen de perfil actualizada para usuario {}", userId);
        return saved;
    }

    public User updateCoverImage(String userId, String imageUrl) {
        if (imageUrl == null || imageUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("La URL de la imagen de portada es obligatoria");
        }
        if (!EntradaSegura.esImagenValida(imageUrl)) {
            throw new IllegalArgumentException("La portada no es válida. Elige otra desde el editor.");
        }
        User user = getUserById(userId);
        user.setCoverImageUrl(imageUrl);
        user.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);
        log.info("Imagen de portada actualizada para usuario {}", userId);
        return saved;
    }

    /** Cambia la contraseña y cierra todas las sesiones abiertas (sube tokenVersion). */
    public User updatePassword(String userId, UpdatePasswordRequest request) {
        User user = getUserById(userId);
        // La contraseña actual también se puede adivinar: cuenta para el mismo bloqueo del login
        loginAttemptService.checkNotLocked(user.getEmail());
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            log.warn("Contraseña incorrecta al intentar cambio para usuario {}", userId);
            loginAttemptService.recordFailure(user.getEmail());
            throw new IllegalArgumentException("La contraseña actual es incorrecta");
        }
        loginAttemptService.reset(user.getEmail());
        if (Credenciales.esClaveComun(request.getNewPassword())) {
            throw new IllegalArgumentException("Esa contraseña es de las primeras que prueba cualquiera. Elige otra.");
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setTokenVersion((user.getTokenVersion() == null ? 0 : user.getTokenVersion()) + 1);
        user.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);
        log.info("Contraseña actualizada para usuario {} (sesiones anteriores cerradas)", userId);
        return saved;
    }

    public Map<String, Object> getUserProfile(String userId) {
        User user = getUserById(userId);
        Map<String, Object> profile = new HashMap<>();
        profile.put("id", user.getId());
        profile.put("email", user.getEmail());
        profile.put("firstName", user.getFirstName());
        profile.put("lastName", user.getLastName());
        profile.put("phone", user.getPhone());
        profile.put("headline", user.getHeadline());
        profile.put("location", user.getLocation());
        profile.put("bio", user.getBio());
        profile.put("profileImageUrl", user.getProfileImageUrl());
        profile.put("coverImageUrl", user.getCoverImageUrl());
        profile.put("createdAt", user.getCreatedAt());
        return profile;
    }

    /** Lo que ve otra persona: el mismo perfil, sin correo ni teléfono. */
    public Map<String, Object> getPublicProfile(String userId) {
        Map<String, Object> profile = getUserProfile(userId);
        profile.remove("email");
        profile.remove("phone");
        return profile;
    }

    public List<User> findSuggestionsForUser(String userId) {
        User user = getUserById(userId);
        if (user.getLocation() == null || user.getLocation().isBlank()) {
            return List.of();
        }
        Query q = new Query(
                Criteria.where("_id").ne(userId).and("location").is(user.getLocation())
        ).limit(10);
        return mongoTemplate.find(q, User.class);
    }

    public Map<String, Object> getUserStatistics(String userId) {
        User user = getUserById(userId);

        long applicationsCount = applicationRepository.countByUserId(userId);
        long skillsCount = user.getSkills() != null ? user.getSkills().size() : 0L;

        int completionScore = 0;
        if (user.getFirstName() != null && !user.getFirstName().isEmpty()) completionScore += 15;
        if (user.getLastName() != null && !user.getLastName().isEmpty()) completionScore += 15;
        if (user.getPhone() != null && !user.getPhone().isEmpty()) completionScore += 10;
        if (user.getHeadline() != null && !user.getHeadline().isEmpty()) completionScore += 15;
        if (user.getBio() != null && !user.getBio().isEmpty()) completionScore += 10;
        if (skillsCount > 0) completionScore += 20;
        if (applicationsCount > 0) completionScore += 15;

        Map<String, Object> statistics = new HashMap<>();
        statistics.put("applicationsCount", applicationsCount);
        statistics.put("matchRate", completionScore);
        statistics.put("skillsCount", skillsCount);
        statistics.put("profileCompleteness", completionScore);
        return statistics;
    }
}
