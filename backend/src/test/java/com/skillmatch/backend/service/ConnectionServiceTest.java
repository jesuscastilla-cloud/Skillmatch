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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static com.skillmatch.backend.model.ConnectionStatus.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class ConnectionServiceTest {

    @Mock private ConnectionRepository connectionRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserService userService;
    @Mock private NotificationService notificationService;
    @Mock private MongoTemplate mongoTemplate;

    @InjectMocks
    private ConnectionService connectionService;

    private User requester;
    private User receiver;
    private Connection pendingConnection;

    @BeforeEach
    void setUp() {
        requester = new User();
        requester.setId("user-id-1");
        requester.setFirstName("Ana");
        requester.setLastName("García");
        requester.setEmail("ana@test.com");

        receiver = new User();
        receiver.setId("user-id-2");
        receiver.setFirstName("Luis");
        receiver.setLastName("Martínez");
        receiver.setEmail("luis@test.com");

        pendingConnection = buildPendingConnection("conn-id-10");
    }

    // ─── sendConnectionRequest ────────────────────────────────────────────────

    @Test
    void sendConnectionRequest_happyPath_savesAndNotifies() {
        ConnectionRequest req = new ConnectionRequest("user-id-2", "Hola!");
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(requester));
        when(userRepository.findById("user-id-2")).thenReturn(Optional.of(receiver));
        when(connectionRepository.findByUserIdAndConnectedUserId("user-id-1", "user-id-2"))
                .thenReturn(Optional.empty());
        when(connectionRepository.findByUserIdAndConnectedUserId("user-id-2", "user-id-1"))
                .thenReturn(Optional.empty());

        Connection saved = buildPendingConnection("conn-id-10");
        when(connectionRepository.save(any(Connection.class))).thenReturn(saved);

        ConnectionResponse response = connectionService.sendConnectionRequest("user-id-1", req);

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(PENDING);
        assertThat(captor.getValue().getMessage()).isEqualTo("Hola!");

        verify(notificationService).createConnectionRequestNotification(
                eq("user-id-2"), eq("user-id-1"), eq("conn-id-10"));

        assertThat(response.getStatus()).isEqualTo("pending");
    }

    @Test
    void sendConnectionRequest_toSelf_throwsIllegalArgument() {
        ConnectionRequest req = new ConnectionRequest("user-id-1", null);

        assertThatThrownBy(() -> connectionService.sendConnectionRequest("user-id-1", req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ti mismo");
    }

    @Test
    void sendConnectionRequest_nullConnectedUserId_throwsIllegalArgument() {
        ConnectionRequest req = new ConnectionRequest(null, null);

        assertThatThrownBy(() -> connectionService.sendConnectionRequest("user-id-1", req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("nulo");
    }

    @Test
    void sendConnectionRequest_requesterNotFound_throwsResourceNotFound() {
        ConnectionRequest req = new ConnectionRequest("user-id-2", null);
        when(userRepository.findById("user-id-1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> connectionService.sendConnectionRequest("user-id-1", req))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void sendConnectionRequest_receiverNotFound_throwsResourceNotFound() {
        ConnectionRequest req = new ConnectionRequest("user-id-2", null);
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(requester));
        when(userRepository.findById("user-id-2")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> connectionService.sendConnectionRequest("user-id-1", req))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void sendConnectionRequest_alreadyExists_throwsDuplicate() {
        ConnectionRequest req = new ConnectionRequest("user-id-2", null);
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(requester));
        when(userRepository.findById("user-id-2")).thenReturn(Optional.of(receiver));
        when(connectionRepository.findByUserIdAndConnectedUserId("user-id-1", "user-id-2"))
                .thenReturn(Optional.of(pendingConnection));

        assertThatThrownBy(() -> connectionService.sendConnectionRequest("user-id-1", req))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void sendConnectionRequest_noNotificationWhenSaveFails() {
        ConnectionRequest req = new ConnectionRequest("user-id-2", null);
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(requester));
        when(userRepository.findById("user-id-2")).thenReturn(Optional.of(receiver));
        when(connectionRepository.findByUserIdAndConnectedUserId("user-id-1", "user-id-2"))
                .thenReturn(Optional.empty());
        when(connectionRepository.findByUserIdAndConnectedUserId("user-id-2", "user-id-1"))
                .thenReturn(Optional.empty());
        when(connectionRepository.save(any())).thenThrow(new RuntimeException("DB error"));

        assertThatThrownBy(() -> connectionService.sendConnectionRequest("user-id-1", req))
                .isInstanceOf(RuntimeException.class);

        verifyNoInteractions(notificationService);
    }

    // ─── acceptConnection ─────────────────────────────────────────────────────

    @Test
    void acceptConnection_happyPath_setsAcceptedAndNotifies() {
        when(connectionRepository.findById("conn-id-10")).thenReturn(Optional.of(pendingConnection));
        Connection saved = buildAcceptedConnection("conn-id-10");
        when(connectionRepository.save(any(Connection.class))).thenReturn(saved);
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(requester));
        when(userRepository.findById("user-id-2")).thenReturn(Optional.of(receiver));

        ConnectionResponse response = connectionService.acceptConnection("conn-id-10", "user-id-2");

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ACCEPTED);
        assertThat(captor.getValue().getRespondedAt()).isNotNull();

        verify(notificationService).createConnectionAcceptedNotification(
                eq("user-id-1"), eq("user-id-2"), eq("conn-id-10"));

        assertThat(response.getStatus()).isEqualTo("accepted");
    }

    @Test
    void acceptConnection_notFound_throwsResourceNotFound() {
        when(connectionRepository.findById("conn-id-99")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> connectionService.acceptConnection("conn-id-99", "user-id-2"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void acceptConnection_wrongUser_throwsUnauthorized() {
        when(connectionRepository.findById("conn-id-10")).thenReturn(Optional.of(pendingConnection));

        assertThatThrownBy(() -> connectionService.acceptConnection("conn-id-10", "user-id-99"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @ParameterizedTest
    @MethodSource("alreadyProcessedStatuses")
    void acceptConnection_alreadyProcessed_throwsIllegalArgument(ConnectionStatus status) {
        pendingConnection.setStatus(status);
        when(connectionRepository.findById("conn-id-10")).thenReturn(Optional.of(pendingConnection));

        assertThatThrownBy(() -> connectionService.acceptConnection("conn-id-10", "user-id-2"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("procesada");
    }

    @Test
    void acceptConnection_nullConnectionId_throwsIllegalArgument() {
        assertThatThrownBy(() -> connectionService.acceptConnection(null, "user-id-2"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptConnection_noNotificationWhenSaveFails() {
        when(connectionRepository.findById("conn-id-10")).thenReturn(Optional.of(pendingConnection));
        when(connectionRepository.save(any())).thenThrow(new RuntimeException("DB error"));

        assertThatThrownBy(() -> connectionService.acceptConnection("conn-id-10", "user-id-2"))
                .isInstanceOf(RuntimeException.class);

        verifyNoInteractions(notificationService);
    }

    // ─── rejectConnection ─────────────────────────────────────────────────────

    @Test
    void rejectConnection_happyPath_setsRejected() {
        when(connectionRepository.findById("conn-id-10")).thenReturn(Optional.of(pendingConnection));
        Connection saved = buildPendingConnection("conn-id-10");
        saved.setStatus(REJECTED);
        when(connectionRepository.save(any(Connection.class))).thenReturn(saved);
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(requester));
        when(userRepository.findById("user-id-2")).thenReturn(Optional.of(receiver));

        ConnectionResponse response = connectionService.rejectConnection("conn-id-10", "user-id-2");

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(REJECTED);
        assertThat(captor.getValue().getRespondedAt()).isNotNull();

        assertThat(response.getStatus()).isEqualTo("rejected");
        verifyNoInteractions(notificationService);
    }

    @Test
    void rejectConnection_notFound_throwsResourceNotFound() {
        when(connectionRepository.findById("conn-id-99")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> connectionService.rejectConnection("conn-id-99", "user-id-2"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void rejectConnection_wrongUser_throwsUnauthorized() {
        when(connectionRepository.findById("conn-id-10")).thenReturn(Optional.of(pendingConnection));

        assertThatThrownBy(() -> connectionService.rejectConnection("conn-id-10", "user-id-99"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @ParameterizedTest
    @MethodSource("alreadyProcessedStatuses")
    void rejectConnection_alreadyProcessed_throwsIllegalArgument(ConnectionStatus status) {
        pendingConnection.setStatus(status);
        when(connectionRepository.findById("conn-id-10")).thenReturn(Optional.of(pendingConnection));

        assertThatThrownBy(() -> connectionService.rejectConnection("conn-id-10", "user-id-2"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("procesada");
    }

    @Test
    void rejectConnection_nullConnectionId_throwsIllegalArgument() {
        assertThatThrownBy(() -> connectionService.rejectConnection(null, "user-id-2"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ─── blockConnection ──────────────────────────────────────────────────────

    @Test
    void blockConnection_byRequester_setsBlocked() {
        when(connectionRepository.findById("conn-id-10")).thenReturn(Optional.of(pendingConnection));

        connectionService.blockConnection("conn-id-10", "user-id-1");

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(BLOCKED);
    }

    @Test
    void blockConnection_byReceiver_setsBlocked() {
        when(connectionRepository.findById("conn-id-10")).thenReturn(Optional.of(pendingConnection));

        connectionService.blockConnection("conn-id-10", "user-id-2");

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(BLOCKED);
    }

    @Test
    void blockConnection_notFound_throwsResourceNotFound() {
        when(connectionRepository.findById("conn-id-99")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> connectionService.blockConnection("conn-id-99", "user-id-1"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void blockConnection_thirdParty_throwsUnauthorized() {
        when(connectionRepository.findById("conn-id-10")).thenReturn(Optional.of(pendingConnection));

        assertThatThrownBy(() -> connectionService.blockConnection("conn-id-10", "user-id-99"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void blockConnection_nullConnectionId_throwsIllegalArgument() {
        assertThatThrownBy(() -> connectionService.blockConnection(null, "user-id-1"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ─── getMyConnections ─────────────────────────────────────────────────────

    @Test
    void getMyConnections_returnsMappedList() {
        Connection c1 = buildAcceptedConnection("conn-id-11");
        Connection c2 = buildAcceptedConnection("conn-id-12");
        when(mongoTemplate.find(any(), eq(Connection.class))).thenReturn(List.of(c1, c2));
        when(userRepository.findAllById(any())).thenReturn(List.of(requester, receiver));

        List<ConnectionResponse> result = connectionService.getMyConnections("user-id-1");

        assertThat(result).hasSize(2);
        assertThat(result).allMatch(r -> "accepted".equals(r.getStatus()));
    }

    @Test
    void getMyConnections_empty_returnsEmptyList() {
        when(mongoTemplate.find(any(), eq(Connection.class))).thenReturn(List.of());

        List<ConnectionResponse> result = connectionService.getMyConnections("user-id-1");

        assertThat(result).isEmpty();
    }

    // ─── getPendingRequests / getSentRequests ─────────────────────────────────

    @Test
    void getPendingRequests_returnsMappedList() {
        List<Connection> pending = List.of(buildPendingConnection("conn-id-20"), buildPendingConnection("conn-id-21"));
        when(connectionRepository.findByConnectedUserIdAndStatus("user-id-1", PENDING)).thenReturn(pending);
        when(userRepository.findAllById(any())).thenReturn(List.of(requester, receiver));

        List<ConnectionResponse> result = connectionService.getPendingRequests("user-id-1");

        assertThat(result).hasSize(2);
        assertThat(result).allMatch(r -> "pending".equals(r.getStatus()));
    }

    @Test
    void getPendingRequests_empty_returnsEmptyList() {
        when(connectionRepository.findByConnectedUserIdAndStatus("user-id-1", PENDING)).thenReturn(List.of());

        assertThat(connectionService.getPendingRequests("user-id-1")).isEmpty();
    }

    @Test
    void getSentRequests_returnsMappedList() {
        List<Connection> sent = List.of(buildPendingConnection("conn-id-22"));
        when(connectionRepository.findByUserIdAndStatus("user-id-1", PENDING)).thenReturn(sent);
        when(userRepository.findAllById(any())).thenReturn(List.of(requester, receiver));

        List<ConnectionResponse> result = connectionService.getSentRequests("user-id-1");

        assertThat(result).hasSize(1);
        assertThat(result).allMatch(r -> "pending".equals(r.getStatus()));
    }

    @Test
    void getSentRequests_empty_returnsEmptyList() {
        when(connectionRepository.findByUserIdAndStatus("user-id-1", PENDING)).thenReturn(List.of());

        assertThat(connectionService.getSentRequests("user-id-1")).isEmpty();
    }

    // ─── areUsersConnected ────────────────────────────────────────────────────

    @Test
    void areUsersConnected_returnsTrue() {
        when(mongoTemplate.count(any(), eq(Connection.class))).thenReturn(1L);

        assertThat(connectionService.areUsersConnected("user-id-1", "user-id-2")).isTrue();
    }

    @Test
    void areUsersConnected_returnsFalse() {
        when(mongoTemplate.count(any(), eq(Connection.class))).thenReturn(0L);

        assertThat(connectionService.areUsersConnected("user-id-1", "user-id-2")).isFalse();
    }

    // ─── getConnectionsCount ─────────────────────────────────────────────────

    @Test
    void getConnectionsCount_returnsCount() {
        when(mongoTemplate.count(any(), eq(Connection.class))).thenReturn(7L);

        assertThat(connectionService.getConnectionsCount("user-id-1")).isEqualTo(7L);
    }

    // ─── getSuggestions ───────────────────────────────────────────────────────

    @Test
    void getSuggestions_returnsList() {
        when(userService.findSuggestionsForUser("user-id-1")).thenReturn(List.of(receiver));

        List<User> result = connectionService.getSuggestions("user-id-1");

        assertThat(result).containsExactly(receiver);
    }

    @Test
    void getSuggestions_nullUserId_throwsIllegalArgument() {
        assertThatThrownBy(() -> connectionService.getSuggestions(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("nulo");
    }

    // ─── MethodSources ────────────────────────────────────────────────────────

    static Stream<ConnectionStatus> alreadyProcessedStatuses() {
        return Stream.of(ACCEPTED, REJECTED, BLOCKED);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private Connection buildPendingConnection(String id) {
        Connection c = new Connection();
        c.setId(id);
        c.setUserId("user-id-1");
        c.setConnectedUserId("user-id-2");
        c.setStatus(PENDING);
        c.setRequestedAt(LocalDateTime.now());
        return c;
    }

    private Connection buildAcceptedConnection(String id) {
        Connection c = buildPendingConnection(id);
        c.setStatus(ACCEPTED);
        c.setRespondedAt(LocalDateTime.now());
        return c;
    }
}
