package com.skillmatch.backend.service;

import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomUserDetailsServiceTest {

    @Mock private UserRepository userRepository;

    @InjectMocks
    private CustomUserDetailsService service;

    private User ana() {
        User u = new User();
        u.setId("6ae0b8c00f26cb76c8451155");
        u.setEmail("ana@correo.co");
        u.setRoles(List.of("USER"));
        return u;
    }

    @Test
    void conCorreo_buscaPorCorreo() {
        when(userRepository.findByEmail("ana@correo.co")).thenReturn(Optional.of(ana()));

        assertThat(service.loadUserByUsername(" Ana@Correo.co ").getUsername()).isEqualTo("ana@correo.co");
        verify(userRepository, never()).findById(anyString());
    }

    @Test
    void conIdDeCuenta_buscaPorId() {
        when(userRepository.findById("6ae0b8c00f26cb76c8451155")).thenReturn(Optional.of(ana()));

        assertThat(service.loadUserByUsername("6ae0b8c00f26cb76c8451155").getUsername()).isEqualTo("ana@correo.co");
        verify(userRepository, never()).findByEmail(anyString());
    }

    @Test
    void siNoExiste_elErrorNoRepiteLoBuscado() {
        when(userRepository.findByEmail("nadie@correo.co")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.loadUserByUsername("nadie@correo.co"))
                .isInstanceOf(UsernameNotFoundException.class)
                .hasMessageNotContaining("nadie");
    }
}
