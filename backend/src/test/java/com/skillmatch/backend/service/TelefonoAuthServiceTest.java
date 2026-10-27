package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.RegistroTelefonoRequest;
import com.skillmatch.backend.model.RegistroPendiente;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.RegistroPendienteRepository;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.security.UserDetailsImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TelefonoAuthServiceTest {

    private static final String TEL = "+573001234567";

    private final MensajeTelefonoService mensajes = mock(MensajeTelefonoService.class);
    private final CodigoCorreoService codigos = mock(CodigoCorreoService.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final RegistroPendienteRepository pendientes = mock(RegistroPendienteRepository.class);
    private final RegistrationService registrationService = mock(RegistrationService.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final JwtTokenProvider tokenProvider = mock(JwtTokenProvider.class);
    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private TelefonoAuthService service;

    @BeforeEach
    void setUp() {
        when(mensajes.disponible()).thenReturn(true);
        service = crear(true);
    }

    private TelefonoAuthService crear(boolean habilitado) {
        return new TelefonoAuthService(habilitado, mensajes, codigos, userRepository, pendientes,
                registrationService, passwordEncoder, tokenProvider, mongoTemplate);
    }

    private RegistroTelefonoRequest registro() {
        return new RegistroTelefonoRequest("300 123 4567", "Clave-segura-123", "Ana", "Prueba", true, true);
    }

    @Test
    void apagado_nadaFunciona() {
        TelefonoAuthService apagado = crear(false);

        assertThat(apagado.disponible()).isFalse();
        assertThatThrownBy(() -> apagado.iniciarRegistro(registro()))
                .isInstanceOf(TelefonoAuthService.TelefonoNoDisponibleException.class);
        assertThatThrownBy(() -> apagado.pedirCodigoEntrada(TEL))
                .isInstanceOf(TelefonoAuthService.TelefonoNoDisponibleException.class);
        verifyNoInteractions(codigos, pendientes);
    }

    @Test
    void registro_guardaPendienteYEnviaCodigoPorSms() {
        when(passwordEncoder.encode("Clave-segura-123")).thenReturn("hash");
        when(codigos.generar(TEL, TelefonoAuthService.REGISTRO)).thenReturn(Optional.of("482913"));

        service.iniciarRegistro(registro());

        ArgumentCaptor<RegistroPendiente> pendiente = ArgumentCaptor.forClass(RegistroPendiente.class);
        verify(pendientes).save(pendiente.capture());
        assertThat(pendiente.getValue().getEmail()).isEqualTo("tel:" + TEL);
        assertThat(pendiente.getValue().getPhone()).isEqualTo(TEL);
        verify(mensajes).enviar(eq(TEL), contains("482913"));
        verify(userRepository, never()).save(any());
    }

    @Test
    void registro_numeroConCuenta_respondeIgualSinEnviarNada() {
        when(userRepository.existsByPhone(TEL)).thenReturn(true);

        service.iniciarRegistro(registro());

        verify(pendientes, never()).save(any());
        verify(mensajes, never()).enviar(anyString(), anyString());
    }

    @Test
    void confirmarRegistro_creaCuentaSinCorreoConTelefonoVerificado() {
        when(codigos.verificar(TEL, TelefonoAuthService.REGISTRO, "482913")).thenReturn(true);
        when(pendientes.findById("tel:" + TEL)).thenReturn(Optional.of(new RegistroPendiente(
                "tel:" + TEL, "hash", "Ana", "Prueba", TEL, "USER", List.of(), new Date())));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId("nuevo-id");
            return u;
        });
        when(tokenProvider.generateToken(any(UserDetailsImpl.class))).thenReturn("jwt");

        AuthResponse sesion = service.confirmarRegistro("+57 300 123 4567", "482913");

        ArgumentCaptor<User> cuenta = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(cuenta.capture());
        assertThat(cuenta.getValue().getEmail()).isNull();
        assertThat(cuenta.getValue().getPhone()).isEqualTo(TEL);
        assertThat(cuenta.getValue().getPhoneVerified()).isTrue();
        assertThat(sesion.getToken()).isEqualTo("jwt");
        verify(pendientes).deleteById("tel:" + TEL);
    }

    @Test
    void entrar_soloEnviaCodigoATelefonosVerificados() {
        User sinVerificar = new User();
        sinVerificar.setPhone(TEL);
        when(userRepository.findByPhone(TEL)).thenReturn(Optional.of(sinVerificar));

        service.pedirCodigoEntrada("3001234567");
        verify(mensajes, never()).enviar(anyString(), anyString());

        sinVerificar.setPhoneVerified(true);
        when(codigos.generar(TEL, TelefonoAuthService.ENTRAR)).thenReturn(Optional.of("111222"));
        service.pedirCodigoEntrada("3001234567");
        verify(mensajes).enviar(eq(TEL), contains("111222"));
    }

    @Test
    void entrar_codigoMalo_noAbreSesion() {
        when(codigos.verificar(TEL, TelefonoAuthService.ENTRAR, "000000")).thenReturn(false);

        assertThatThrownBy(() -> service.entrarConCodigo(TEL, "000000"))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(tokenProvider);
    }

    @Test
    void agregarTelefono_conCodigo_quedaVerificadoEnLaCuenta() {
        User ana = new User();
        ana.setId("ana-id");
        when(codigos.verificar(TEL, TelefonoAuthService.VERIFICAR + ":ana-id", "482913")).thenReturn(true);
        when(userRepository.findById("ana-id")).thenReturn(Optional.of(ana));

        service.confirmarTelefono("ana-id", "3001234567", "482913");

        assertThat(ana.getPhone()).isEqualTo(TEL);
        assertThat(ana.getPhoneVerified()).isTrue();
        verify(userRepository).save(ana);
    }
}
