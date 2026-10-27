package com.skillmatch.backend.security;

import com.skillmatch.backend.model.RevokedToken;
import com.skillmatch.backend.repository.RevokedTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TokenBlacklistServiceTest {

    @Mock private RevokedTokenRepository revokedTokenRepository;

    @InjectMocks
    private TokenBlacklistService service;

    @Test
    void blacklist_guardaLaHuellaYNoElToken() {
        service.blacklist("eyJ.token.secreto", 1_900_000_000_000L);

        ArgumentCaptor<RevokedToken> guardado = ArgumentCaptor.forClass(RevokedToken.class);
        verify(revokedTokenRepository).save(guardado.capture());
        assertThat(guardado.getValue().getTokenHash())
                .hasSize(64)
                .doesNotContain("secreto")
                .isEqualTo(TokenBlacklistService.hash("eyJ.token.secreto"));
        assertThat(guardado.getValue().getExpiresAt().getTime()).isEqualTo(1_900_000_000_000L);
    }

    @Test
    void isBlacklisted_consultaLaBase() {
        when(revokedTokenRepository.existsById(TokenBlacklistService.hash("cerrado"))).thenReturn(true);

        assertThat(service.isBlacklisted("cerrado")).isTrue();
        assertThat(service.isBlacklisted("abierto")).isFalse();
    }
}
