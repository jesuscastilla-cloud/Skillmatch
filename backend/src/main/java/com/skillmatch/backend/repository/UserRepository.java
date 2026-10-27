package com.skillmatch.backend.repository;

import com.skillmatch.backend.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByEmail(String email);

    Boolean existsByEmail(String email);

    boolean existsByPhone(String phone);

    boolean existsByPhoneAndIdNot(String phone, String id);

    Optional<User> findByPhone(String phone);

    Optional<User> findByGoogleId(String googleId);

    long countByRolesContaining(String role);
}
