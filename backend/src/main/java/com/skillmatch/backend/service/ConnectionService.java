package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.ConnectionRequest;
import com.skillmatch.backend.dto.ConnectionResponse;
import com.skillmatch.backend.exception.DuplicateResourceException;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.exception.UnauthorizedException;
import com.skillmatch.backend.model.Connection;
import com.skillmatch.backend.model.ConnectionStatus;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.ConnectionRepository;
import com.skillmatch.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ConnectionService {

    private final ConnectionRepository connectionRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final NotificationService notificationService;
    private final MongoTemplate mongoTemplate;

    public ConnectionResponse sendConnectionRequest(String userId, ConnectionRequest request) {
        String connectedUserId = request.getConnectedUserId();
        if (connectedUserId == null || connectedUserId.isBlank()) {
            throw new IllegalArgumentException("ID de usuario conectado no puede ser nulo");
        }
        if (userId.equals(connectedUserId)) {
            throw new IllegalArgumentException("No puedes enviarte una solicitud a ti mismo");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado: " + userId));
        User connectedUser = userRepository.findById(connectedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado: " + connectedUserId));

        if (findConnectionBetweenUsers(userId, connectedUserId).isPresent()) {
            throw new DuplicateResourceException("Ya existe una conexión o solicitud pendiente con este usuario");
        }

        Connection connection = new Connection();
        connection.setUserId(userId);
        connection.setConnectedUserId(connectedUserId);
        connection.setStatus(ConnectionStatus.PENDING);
        connection.setMessage(request.getMessage());
        connection.setRequestedAt(LocalDateTime.now());
        connection.setCreatedAt(LocalDateTime.now());
        connection.setUpdatedAt(LocalDateTime.now());

        connection = connectionRepository.save(connection);

        notificationService.createConnectionRequestNotification(connectedUserId, userId, connection.getId());

        log.info("Solicitud de conexión enviada: userId={} → connectedUserId={}", userId, connectedUserId);
        return mapToResponse(connection, user, connectedUser);
    }

    public ConnectionResponse acceptConnection(String connectionId, String userId) {
        if (connectionId == null) throw new IllegalArgumentException("ID de conexión no puede ser nulo");
        Connection connection = connectionRepository.findById(connectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Solicitud de conexión no encontrada"));

        if (!connection.getConnectedUserId().equals(userId)) {
            throw new UnauthorizedException("No tienes permiso para aceptar esta solicitud");
        }
        if (ConnectionStatus.PENDING != connection.getStatus()) {
            throw new IllegalArgumentException("Esta solicitud ya fue procesada");
        }

        connection.setStatus(ConnectionStatus.ACCEPTED);
        connection.setRespondedAt(LocalDateTime.now());
        connection.setUpdatedAt(LocalDateTime.now());
        connection = connectionRepository.save(connection);

        notificationService.createConnectionAcceptedNotification(connection.getUserId(), userId, connectionId);

        log.info("Conexión {} aceptada por usuario {}", connectionId, userId);
        return loadAndMapSingle(connection);
    }

    public ConnectionResponse rejectConnection(String connectionId, String userId) {
        if (connectionId == null) throw new IllegalArgumentException("ID de conexión no puede ser nulo");
        Connection connection = connectionRepository.findById(connectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Solicitud de conexión no encontrada"));

        if (!connection.getConnectedUserId().equals(userId)) {
            throw new UnauthorizedException("No tienes permiso para rechazar esta solicitud");
        }
        if (ConnectionStatus.PENDING != connection.getStatus()) {
            throw new IllegalArgumentException("Esta solicitud ya fue procesada");
        }

        connection.setStatus(ConnectionStatus.REJECTED);
        connection.setRespondedAt(LocalDateTime.now());
        connection.setUpdatedAt(LocalDateTime.now());
        connection = connectionRepository.save(connection);

        log.info("Conexión {} rechazada por usuario {}", connectionId, userId);
        return loadAndMapSingle(connection);
    }

    public void blockConnection(String connectionId, String userId) {
        if (connectionId == null) throw new IllegalArgumentException("ID de conexión no puede ser nulo");
        Connection connection = connectionRepository.findById(connectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Conexión no encontrada"));

        if (!connection.getUserId().equals(userId) && !connection.getConnectedUserId().equals(userId)) {
            throw new UnauthorizedException("No tienes permiso para bloquear esta conexión");
        }

        connection.setStatus(ConnectionStatus.BLOCKED);
        connection.setUpdatedAt(LocalDateTime.now());
        connectionRepository.save(connection);
        log.warn("Conexión {} bloqueada por usuario {}", connectionId, userId);
    }

    public List<ConnectionResponse> getMyConnections(String userId) {
        List<Connection> connections = findAcceptedConnectionsByUserId(userId);
        return mapList(connections);
    }

    public List<ConnectionResponse> getPendingRequests(String userId) {
        return mapList(connectionRepository.findByConnectedUserIdAndStatus(userId, ConnectionStatus.PENDING));
    }

    public List<ConnectionResponse> getSentRequests(String userId) {
        return mapList(connectionRepository.findByUserIdAndStatus(userId, ConnectionStatus.PENDING));
    }

    public boolean areUsersConnected(String userId1, String userId2) {
        Criteria criteria = Criteria.where("status").is(ConnectionStatus.ACCEPTED)
                .orOperator(
                        Criteria.where("userId").is(userId1).and("connectedUserId").is(userId2),
                        Criteria.where("userId").is(userId2).and("connectedUserId").is(userId1)
                );
        return mongoTemplate.count(new Query(criteria), Connection.class) > 0;
    }

    public long getConnectionsCount(String userId) {
        Criteria criteria = Criteria.where("status").is(ConnectionStatus.ACCEPTED)
                .orOperator(
                        Criteria.where("userId").is(userId),
                        Criteria.where("connectedUserId").is(userId)
                );
        return mongoTemplate.count(new Query(criteria), Connection.class);
    }

    public List<User> getSuggestions(String userId) {
        if (userId == null) throw new IllegalArgumentException("ID de usuario no puede ser nulo");
        return userService.findSuggestionsForUser(userId);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Optional<Connection> findConnectionBetweenUsers(String u1, String u2) {
        Optional<Connection> conn = connectionRepository.findByUserIdAndConnectedUserId(u1, u2);
        return conn.isPresent() ? conn : connectionRepository.findByUserIdAndConnectedUserId(u2, u1);
    }

    private List<Connection> findAcceptedConnectionsByUserId(String userId) {
        Criteria criteria = Criteria.where("status").is(ConnectionStatus.ACCEPTED)
                .orOperator(
                        Criteria.where("userId").is(userId),
                        Criteria.where("connectedUserId").is(userId)
                );
        return mongoTemplate.find(new Query(criteria), Connection.class);
    }

    private ConnectionResponse loadAndMapSingle(Connection connection) {
        User user = userRepository.findById(connection.getUserId()).orElse(null);
        User connectedUser = userRepository.findById(connection.getConnectedUserId()).orElse(null);
        return mapToResponse(connection, user, connectedUser);
    }

    private List<ConnectionResponse> mapList(List<Connection> connections) {
        if (connections.isEmpty()) return List.of();
        Set<String> allUserIds = connections.stream()
                .flatMap(c -> Stream.of(c.getUserId(), c.getConnectedUserId()))
                .collect(Collectors.toSet());
        Map<String, User> userMap = userRepository.findAllById(allUserIds)
                .stream().collect(Collectors.toMap(User::getId, u -> u));
        return connections.stream()
                .map(c -> mapToResponse(c, userMap.get(c.getUserId()), userMap.get(c.getConnectedUserId())))
                .collect(Collectors.toList());
    }

    private ConnectionResponse mapToResponse(Connection connection, User user, User connectedUser) {
        ConnectionResponse response = new ConnectionResponse();
        response.setId(connection.getId());
        if (user != null) {
            response.setUserId(user.getId());
            response.setUserName(user.getFirstName() + " " + user.getLastName());
            response.setUserEmail(user.getEmail());
            response.setUserHeadline(user.getHeadline());
            response.setUserProfileImage(user.getProfileImageUrl());
        }
        if (connectedUser != null) {
            response.setConnectedUserId(connectedUser.getId());
            response.setConnectedUserName(connectedUser.getFirstName() + " " + connectedUser.getLastName());
            response.setConnectedUserEmail(connectedUser.getEmail());
            response.setConnectedUserHeadline(connectedUser.getHeadline());
            response.setConnectedUserProfileImage(connectedUser.getProfileImageUrl());
        }
        response.setStatus(connection.getStatus() != null ? connection.getStatus().name().toLowerCase() : null);
        response.setMessage(connection.getMessage());
        response.setRequestedAt(connection.getRequestedAt());
        response.setRespondedAt(connection.getRespondedAt());
        return response;
    }
}
