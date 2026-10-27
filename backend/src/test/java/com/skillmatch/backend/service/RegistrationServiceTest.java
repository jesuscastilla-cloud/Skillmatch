package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.RegisterRequest;
import com.skillmatch.backend.exception.DuplicateResourceException;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.model.Consentimiento;
import org.springframework.test.util.ReflectionTestUtils;
import org.mockito.ArgumentCaptor;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class RegistrationServiceTest {

    @Mock private AuthenticationManager authenticationManager;
    @Mock private UserRepository userRepository;
    @Mock private CompanyRepository companyRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtTokenProvider tokenProvider;

    @InjectMocks
    private RegistrationService registrationService;

    private RegisterRequest userRequest;
    private RegisterRequest empresaRequest;

    @BeforeEach
    void setUp() {
        userRequest = new RegisterRequest("user@test.com", "Clave-de-prueba-1", "Ana", "García", "3001234567", "USER");
        empresaRequest = new RegisterRequest("empresa@test.com", "Clave-de-prueba-1", "TechCorp", "SAS", "3009876543", "EMPRESA");
    }

    @Test
    void register_userType_createsUserWithUserRole() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");

        User savedUser = new User();
        savedUser.setId("user-id-10");
        savedUser.setEmail("user@test.com");
        savedUser.setFirstName("Ana");
        savedUser.setLastName("García");
        savedUser.setRoles(List.of("USER"));
        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        Authentication mockAuth = mock(Authentication.class);
        when(authenticationManager.authenticate(any())).thenReturn(mockAuth);
        when(tokenProvider.generateToken(mockAuth)).thenReturn("jwt.token");
        when(tokenProvider.getExpirationMillis()).thenReturn(86400000L);

        AuthResponse result = registrationService.register(userRequest);

        assertThat(result.getRole()).isEqualTo("USER");
        assertThat(result.getEmail()).isEqualTo("user@test.com");
        assertThat(result.getId()).isEqualTo("user-id-10");
        assertThat(result.getCompanyId()).isNull();
        verify(companyRepository, never()).save(any());
    }

    @Test
    void register_empresaType_createsCompanyProfile() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");

        User savedUser = new User();
        savedUser.setId("user-id-20");
        savedUser.setEmail("empresa@test.com");
        savedUser.setFirstName("TechCorp");
        savedUser.setLastName("SAS");
        savedUser.setRoles(List.of("EMPRESA"));
        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        Company savedCompany = new Company();
        savedCompany.setId("company-id-5");
        when(companyRepository.save(any(Company.class))).thenReturn(savedCompany);

        Authentication mockAuth = mock(Authentication.class);
        when(authenticationManager.authenticate(any())).thenReturn(mockAuth);
        when(tokenProvider.generateToken(mockAuth)).thenReturn("jwt.token");
        when(tokenProvider.getExpirationMillis()).thenReturn(86400000L);

        AuthResponse result = registrationService.register(empresaRequest);

        assertThat(result.getRole()).isEqualTo("EMPRESA");
        assertThat(result.getCompanyId()).isEqualTo("company-id-5");
        verify(companyRepository).save(any(Company.class));
    }

    @Test
    void register_duplicateEmail_throwsDuplicateResourceException() {
        when(userRepository.existsByEmail("user@test.com")).thenReturn(true);

        assertThatThrownBy(() -> registrationService.register(userRequest))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("email");

        verify(userRepository, never()).save(any());
    }

    @Test
    void register_contrasenaComun_seRechazaSinCrearCuenta() {
        userRequest.setPassword("Cartagena");

        assertThatThrownBy(() -> registrationService.register(userRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Elige otra");
        verify(userRepository, never()).save(any());
    }

    // ─── Consentimiento (Ley 1581) ────────────────────────────────────────────

    @Test
    void register_conCasillas_guardaLaPruebaDelConsentimiento() {
        userRequest.setAceptaPolitica(true);
        userRequest.setMayorDeEdad(true);
        ArgumentCaptor<User> guardado = registrarYCapturar();

        assertThat(guardado.getValue().getConsentimientos())
                .extracting(Consentimiento::getTipo, Consentimiento::getVersion)
                .containsExactly(tuple(Consentimiento.POLITICA_DATOS, "0.1"), tuple(Consentimiento.MAYOR_DE_EDAD, "0.1"));
        assertThat(guardado.getValue().getConsentimientos()).allSatisfy(c -> assertThat(c.getFecha()).isNotNull());
    }

    @Test
    void register_sinCasillas_mientrasNoSeExige_creaLaCuenta() {
        ArgumentCaptor<User> guardado = registrarYCapturar();

        assertThat(guardado.getValue().getConsentimientos()).isEmpty();
    }

    @Test
    void register_sinAceptarPolitica_cuandoSeExige_noCreaLaCuenta() {
        ReflectionTestUtils.setField(registrationService, "exigirConsentimiento", true);

        assertThatThrownBy(() -> registrationService.register(userRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("política");
        verify(userRepository, never()).save(any());
    }

    @Test
    void register_personaSinMayoriaDeEdad_cuandoSeExige_noCreaLaCuenta() {
        ReflectionTestUtils.setField(registrationService, "exigirConsentimiento", true);
        userRequest.setAceptaPolitica(true);

        assertThatThrownBy(() -> registrationService.register(userRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("mayor de edad");
        verify(userRepository, never()).save(any());
    }

    private ArgumentCaptor<User> registrarYCapturar() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId("user-id-10");
            return u;
        });
        Authentication mockAuth = mock(Authentication.class);
        when(authenticationManager.authenticate(any())).thenReturn(mockAuth);
        when(tokenProvider.generateToken(mockAuth)).thenReturn("jwt.token");
        when(tokenProvider.getExpirationMillis()).thenReturn(86400000L);

        registrationService.register(userRequest);

        ArgumentCaptor<User> guardado = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(guardado.capture());
        return guardado;
    }
}
