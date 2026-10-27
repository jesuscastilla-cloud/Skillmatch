package com.skillmatch.backend.repository;

import com.skillmatch.backend.model.Connection;
import com.skillmatch.backend.model.ConnectionStatus;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;

class ConnectionRepositoryTest {

    @Test
    void existsBetween_veElBloqueoEnLosDosSentidos() {
        ConnectionRepository repo = mock(ConnectionRepository.class, CALLS_REAL_METHODS);
        Connection bloqueada = new Connection();
        bloqueada.setUserId("ana");
        bloqueada.setConnectedUserId("luis");
        bloqueada.setStatus(ConnectionStatus.BLOCKED);
        doReturn(Optional.empty()).when(repo).findByUserIdAndConnectedUserId(anyString(), anyString());
        doReturn(Optional.of(bloqueada)).when(repo).findByUserIdAndConnectedUserId("ana", "luis");

        assertThat(repo.existsBetween("ana", "luis", ConnectionStatus.BLOCKED)).isTrue();
        assertThat(repo.existsBetween("luis", "ana", ConnectionStatus.BLOCKED)).isTrue();
        assertThat(repo.existsBetween("ana", "luis", ConnectionStatus.ACCEPTED)).isFalse();
        assertThat(repo.existsBetween("ana", "otra", ConnectionStatus.BLOCKED)).isFalse();
    }
}
