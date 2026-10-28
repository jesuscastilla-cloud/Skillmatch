package com.skillmatch.backend.service;

import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecuperacionServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private CodigoCorreoService codigos;
    @Mock private CorreoService correo;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private LoginAttemptService loginAttemptService;

    @InjectMocks
    private RecuperacionService service;

    @Test
    void correoSinCuenta_noEnviaNada() {
        when(userRepository.findByEmail("nadie@correo.co")).thenReturn(Optional.empty());

        service.pedirCodigo("nadie@correo.co");

        verifyNoInteractions(codigos, correo);
    }

    @Test
    void correoConCuenta_enviaElCodigo() {
        User ana = new User();
        ana.setFirstName("Ana");
        when(userRepository.findByEmail("ana@correo.co")).thenReturn(Optional.of(ana));
        when(codigos.generar("ana@correo.co", CodigoCorreoService.RECUPERAR_CLAVE)).thenReturn(Optional.of("482913"));

        service.pedirCodigo("ana@correo.co");

        verify(correo).enviar(eq("ana@correo.co"), anyString(), contains("482913"));
    }

    @Test
    void codigoMalo_noCambiaNada() {
        when(codigos.verificar("ana@correo.co", CodigoCorreoService.RECUPERAR_CLAVE, "000000")).thenReturn(false);

        assertThatThrownBy(() -> service.cambiarClave("ana@correo.co", "000000", "Clave-nueva-456"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no es correcto");
        verify(userRepository, never()).save(any());
    }

    @Test
    void codigoBueno_cambiaLaClaveYCierraLasSesiones() {
        User ana = new User();
        ana.setId("ana-id");
        ana.setTokenVersion(2);
        when(codigos.verificar("ana@correo.co", CodigoCorreoService.RECUPERAR_CLAVE, "482913")).thenReturn(true);
        when(userRepository.findByEmail("ana@correo.co")).thenReturn(Optional.of(ana));
        when(passwordEncoder.encode("Clave-nueva-456")).thenReturn("hash-nuevo");

        service.cambiarClave("ana@correo.co", "482913", "Clave-nueva-456");

        ArgumentCaptor<User> guardado = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(guardado.capture());
        assertThat(guardado.getValue().getPassword()).isEqualTo("hash-nuevo");
        assertThat(guardado.getValue().getTokenVersion()).isEqualTo(3);
        assertThat(guardado.getValue().getEmailVerified()).isTrue();
        verify(loginAttemptService).reset("ana@correo.co");
    }

    @Test
    void claveComun_seRechazaAntesDeGastarElCodigo() {
        assertThatThrownBy(() -> service.cambiarClave("ana@correo.co", "482913", "Cartagena1"))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(codigos);
    }
}
