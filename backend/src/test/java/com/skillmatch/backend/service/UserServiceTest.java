package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.UpdatePasswordRequest;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.ApplicationRepository;
import com.skillmatch.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private CompanyService companyService;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private LoginAttemptService loginAttemptService;

    @InjectMocks
    private UserService userService;

    @Test
    void getPublicProfile_quitaCorreoYTelefono() {
        User user = new User();
        user.setId("user-id-1");
        user.setFirstName("Ana");
        user.setHeadline("Diseñadora");
        user.setEmail("ana@test.com");
        user.setPhone("3001234567");
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(user));

        Map<String, Object> profile = userService.getPublicProfile("user-id-1");

        assertThat(profile).containsEntry("firstName", "Ana").containsEntry("headline", "Diseñadora");
        assertThat(profile).doesNotContainKeys("email", "phone");
    }

    @Test
    void updatePassword_subeLaVersionDeSesiones() {
        User user = new User();
        user.setId("user-id-1");
        user.setPassword("hash-viejo");
        user.setTokenVersion(2);
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("actual-123", "hash-viejo")).thenReturn(true);
        when(passwordEncoder.encode("nueva-12345")).thenReturn("hash-nuevo");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User saved = userService.updatePassword("user-id-1", new UpdatePasswordRequest("actual-123", "nueva-12345"));

        assertThat(saved.getTokenVersion()).isEqualTo(3);
        assertThat(saved.getPassword()).isEqualTo("hash-nuevo");
    }

    @Test
    void updatePassword_contrasenaActualIncorrecta_noCambiaNada() {
        User user = new User();
        user.setId("user-id-1");
        user.setPassword("hash-viejo");
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("mala", "hash-viejo")).thenReturn(false);

        assertThatThrownBy(() -> userService.updatePassword("user-id-1", new UpdatePasswordRequest("mala", "nueva-12345")))
                .isInstanceOf(IllegalArgumentException.class);
        verify(userRepository, never()).save(any());
        verify(loginAttemptService).recordFailure(user.getEmail());
    }

    @Test
    void getUserStatistics_sinVistasInventadas() {
        User user = new User();
        user.setId("user-id-1");
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(user));
        when(applicationRepository.countByUserId("user-id-1")).thenReturn(2L);

        Map<String, Object> stats = userService.getUserStatistics("user-id-1");

        assertThat(stats).containsEntry("applicationsCount", 2L).doesNotContainKey("profileViews");
    }
}
