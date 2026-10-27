package com.skillmatch.backend.service;

import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.NotificationRepository;
import com.skillmatch.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class DatosPersonalesServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private CompanyRepository companyRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private UserService userService;
    @Mock private ApplicationService applicationService;
    @Mock private SavedJobService savedJobService;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private LoginAttemptService loginAttemptService;

    @InjectMocks
    private DatosPersonalesService service;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId("user-id-1");
        user.setEmail("ana@test.com");
        user.setPassword("hash");
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(user));
    }

    @Test
    void contrasenaMala_noBorraNada() {
        when(passwordEncoder.matches("mala", "hash")).thenReturn(false);

        assertThatThrownBy(() -> service.borrarCuenta("user-id-1", "mala"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(loginAttemptService).recordFailure("ana@test.com");
        verify(mongoTemplate, never()).remove(any(Query.class), any(Class.class));
        verify(userRepository, never()).delete(any());
    }

    @Test
    void contrasenaCorrecta_borraTodoYLaCuenta() {
        when(passwordEncoder.matches("buena", "hash")).thenReturn(true);
        when(companyRepository.findByUserId("user-id-1")).thenReturn(Optional.empty());
        when(mongoTemplate.find(any(Query.class), any(Class.class))).thenReturn(List.of());

        service.borrarCuenta("user-id-1", "buena");

        // Notificaciones, mensajes, conexiones, postulaciones y vacantes guardadas
        verify(mongoTemplate, times(5)).remove(any(Query.class), any(Class.class));
        verify(userRepository).delete(user);
        verify(loginAttemptService).reset("ana@test.com");
    }

    @Test
    void empresa_quedaAnonimaYSusVacantesCerradas() {
        Company company = new Company();
        company.setId("company-1");
        company.setName("TechCorp");
        company.setEmail("contacto@techcorp.co");
        company.setPhone("6051234567");
        company.setUserId("user-id-1");
        when(passwordEncoder.matches("buena", "hash")).thenReturn(true);
        when(companyRepository.findByUserId("user-id-1")).thenReturn(Optional.of(company));
        when(mongoTemplate.find(any(Query.class), any(Class.class))).thenReturn(List.of());

        service.borrarCuenta("user-id-1", "buena");

        ArgumentCaptor<Company> guardada = ArgumentCaptor.forClass(Company.class);
        verify(companyRepository).save(guardada.capture());
        assertThat(guardada.getValue().getName()).isEqualTo("Empresa eliminada");
        assertThat(guardada.getValue().getEmail()).isNull();
        assertThat(guardada.getValue().getPhone()).isNull();
        assertThat(guardada.getValue().getUserId()).isNull();
        assertThat(guardada.getValue().getActive()).isFalse();
        verify(mongoTemplate).updateMulti(any(Query.class), any(Update.class), eq(Job.class));
    }
}
