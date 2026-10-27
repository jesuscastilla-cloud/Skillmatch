package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.RegisterRequest;
import com.skillmatch.backend.model.CanjeGoogle;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.security.TokenBlacklistService;
import com.skillmatch.backend.service.GoogleAuthService.DatosGoogle;
import com.skillmatch.backend.service.GoogleAuthService.GoogleRechazoException;
import com.skillmatch.backend.service.GoogleAuthService.Intencion;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SuppressWarnings("null")
class GoogleAuthServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final RegistrationService registrationService = mock(RegistrationService.class);
    private final AuthenticationService authenticationService = mock(AuthenticationService.class);
    private final CorreoService correo = mock(CorreoService.class);
    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private GoogleAuthService service;

    private final DatosGoogle ana = new DatosGoogle("google-123", "Ana@Gmail.com", true, "Ana", "Pérez",
            "https://lh3.googleusercontent.com/foto");

    @BeforeEach
    void setUp() {
        service = new GoogleAuthService("id", "secreto", userRepository, registrationService,
                authenticationService, correo, mongoTemplate);
        when(userRepository.findByGoogleId(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            if (u.getId() == null) u.setId("nuevo-id");
            return u;
        });
        when(registrationService.consentimientos(any(), anyBoolean())).thenReturn(List.of());
    }

    private User cuenta(Boolean correoVerificado) {
        User u = new User();
        u.setId("cuenta-id");
        u.setEmail("ana@gmail.com");
        u.setFirstName("Ana");
        u.setPassword("hash-viejo");
        u.setEnabled(true);
        u.setEmailVerified(correoVerificado);
        u.setTokenVersion(2);
        u.setRoles(List.of("USER"));
        return u;
    }

    @Test
    void disponible_soloConLasDosCredenciales() {
        assertThat(service.disponible()).isTrue();
        assertThat(new GoogleAuthService("id", "", userRepository, registrationService,
                authenticationService, correo, mongoTemplate).disponible()).isFalse();
    }

    @Test
    void correoSinVerificarEnGoogle_noEntra() {
        DatosGoogle sinVerificar = new DatosGoogle("google-123", "ana@gmail.com", false, "Ana", "P", null);

        assertThatThrownBy(() -> service.entrar(sinVerificar, Intencion.NINGUNA))
                .isInstanceOf(GoogleRechazoException.class)
                .extracting("motivo").isEqualTo("correo_no_verificado");
        verify(userRepository, never()).save(any());
    }

    @Test
    void yaEntroConGoogle_entraSinCambiarNada() {
        User u = cuenta(true);
        u.setGoogleId("google-123");
        when(userRepository.findByGoogleId("google-123")).thenReturn(Optional.of(u));

        assertThat(service.entrar(ana, Intencion.NINGUNA)).isSameAs(u);
        verify(userRepository, never()).save(any());
    }

    @Test
    void cuentaConCorreoVerificado_seUneYConservaSuContrasena() {
        User u = cuenta(true);
        when(userRepository.findByEmail("ana@gmail.com")).thenReturn(Optional.of(u));

        service.entrar(ana, Intencion.NINGUNA);

        assertThat(u.getGoogleId()).isEqualTo("google-123");
        assertThat(u.getPassword()).isEqualTo("hash-viejo");
        assertThat(u.getTokenVersion()).isEqualTo(2);
        verify(userRepository).save(u);
        verify(correo).enviar(eq("ana@gmail.com"), contains("unida a Google"), anyString());
    }

    @Test
    void cuentaConCorreoSinProbar_pierdeLaContrasenaYSusSesiones() {
        // Pudo crearla otra persona con el correo de Ana (pre-registro)
        User u = cuenta(null);
        when(userRepository.findByEmail("ana@gmail.com")).thenReturn(Optional.of(u));

        service.entrar(ana, Intencion.NINGUNA);

        assertThat(u.getPassword()).isNull();
        assertThat(u.getTokenVersion()).isEqualTo(3);
        assertThat(u.getEmailVerified()).isTrue();
        assertThat(u.getGoogleId()).isEqualTo("google-123");
        verify(correo).enviar(eq("ana@gmail.com"), anyString(), contains("quitamos la contraseña anterior"));
    }

    @Test
    void cuentaDesactivada_noEntraNiSeUne() {
        User u = cuenta(true);
        u.setEnabled(false);
        when(userRepository.findByEmail("ana@gmail.com")).thenReturn(Optional.of(u));

        assertThatThrownBy(() -> service.entrar(ana, Intencion.NINGUNA))
                .extracting("motivo").isEqualTo("cuenta_desactivada");
        assertThat(u.getGoogleId()).isNull();
        verify(userRepository, never()).save(any());
    }

    @Test
    void cuentaNueva_seCreaVerificadaSinContrasena() {
        User nueva = service.entrar(ana, new Intencion("USER", true, true));

        assertThat(nueva.getEmail()).isEqualTo("ana@gmail.com");
        assertThat(nueva.getPassword()).isNull();
        assertThat(nueva.getEmailVerified()).isTrue();
        assertThat(nueva.getGoogleId()).isEqualTo("google-123");
        assertThat(nueva.getRoles()).containsExactly("USER");
        assertThat(nueva.getProfileImageUrl()).isEqualTo("https://lh3.googleusercontent.com/foto");
        ArgumentCaptor<RegisterRequest> solicitud = ArgumentCaptor.forClass(RegisterRequest.class);
        verify(registrationService).consentimientos(solicitud.capture(), eq(true));
        assertThat(solicitud.getValue().getAceptaPolitica()).isTrue();
        assertThat(solicitud.getValue().getMayorDeEdad()).isTrue();
        verify(registrationService, never()).createCompanyProfile(any(), any());
    }

    @Test
    void cuentaNuevaDeEmpresa_creaTambienElPerfilDeEmpresa() {
        User nueva = service.entrar(ana, new Intencion("EMPRESA", true, false));

        assertThat(nueva.getRoles()).containsExactly("EMPRESA");
        verify(registrationService).createCompanyProfile(eq(nueva), any(RegisterRequest.class));
    }

    @Test
    void cuentaNuevaSinConsentimientoExigido_noSeCrea() {
        when(registrationService.consentimientos(any(), anyBoolean()))
                .thenThrow(new IllegalArgumentException("Para crear la cuenta debes aceptar la política"));

        assertThatThrownBy(() -> service.entrar(ana, Intencion.NINGUNA))
                .extracting("motivo").isEqualTo("consentimiento");
        verify(userRepository, never()).save(any());
    }

    @Test
    void fotoQueNoEsHttps_noSeGuarda() {
        DatosGoogle conFotoRara = new DatosGoogle("g-2", "luis@gmail.com", true, "Luis", null, "javascript:alert(1)");

        User nueva = service.entrar(conFotoRara, Intencion.NINGUNA);

        assertThat(nueva.getProfileImageUrl()).isNull();
        assertThat(nueva.getLastName()).isEmpty();
    }

    @Test
    void canje_guardaSoloLaHuellaYSirveUnaVez() {
        User u = cuenta(true);
        String codigo = service.crearCanje(u);

        ArgumentCaptor<CanjeGoogle> guardado = ArgumentCaptor.forClass(CanjeGoogle.class);
        verify(mongoTemplate).save(guardado.capture());
        assertThat(guardado.getValue().getHash()).isEqualTo(TokenBlacklistService.hash(codigo)).isNotEqualTo(codigo);
        assertThat(codigo).hasSizeGreaterThanOrEqualTo(40);

        AuthResponse sesion = new AuthResponse("jwt", "cuenta-id", "ana@gmail.com", "Ana", "P");
        when(mongoTemplate.findAndRemove(any(Query.class), eq(CanjeGoogle.class)))
                .thenReturn(guardado.getValue())
                .thenReturn(null);
        when(userRepository.findById("cuenta-id")).thenReturn(Optional.of(u));
        when(authenticationService.sesionPara(u)).thenReturn(sesion);

        assertThat(service.canjear(codigo)).isSameAs(sesion);
        assertThatThrownBy(() -> service.canjear(codigo)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void canjeVencido_noAbreSesion() {
        when(mongoTemplate.findAndRemove(any(Query.class), eq(CanjeGoogle.class)))
                .thenReturn(new CanjeGoogle("h", "cuenta-id", Date.from(Instant.now().minusSeconds(5))));

        assertThatThrownBy(() -> service.canjear("codigo")).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(authenticationService);
    }
}
