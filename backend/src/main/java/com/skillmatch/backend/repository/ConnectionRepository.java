package com.skillmatch.backend.repository;

import com.skillmatch.backend.model.Connection;
import com.skillmatch.backend.model.ConnectionStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConnectionRepository extends MongoRepository<Connection, String> {

    List<Connection> findByUserIdAndStatus(String userId, ConnectionStatus status);

    List<Connection> findByConnectedUserIdAndStatus(String connectedUserId, ConnectionStatus status);

    Optional<Connection> findByUserIdAndConnectedUserId(String userId, String connectedUserId);

    /** ¿Hay una conexión con este estado entre las dos personas, en cualquier sentido? */
    default boolean existsBetween(String userA, String userB, ConnectionStatus status) {
        return findByUserIdAndConnectedUserId(userA, userB).filter(c -> c.getStatus() == status).isPresent()
                || findByUserIdAndConnectedUserId(userB, userA).filter(c -> c.getStatus() == status).isPresent();
    }
}
