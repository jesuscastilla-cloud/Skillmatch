package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.RegisterRequest;
import com.skillmatch.backend.exception.DuplicateResourceException;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Consentimiento;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.validation.Credenciales;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RegistrationService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    /** Versión de la política vigente (la que muestra politica-datos.html). */
    @Value("${app.privacidad.version-politica:0.1}")
    private String versionPolitica = "0.1";

    /**
     * false mientras el frontend no envíe aceptaPolitica / mayorDeEdad: así el registro
     * actual no se rompe. Cuando los envíe, poner PRIVACIDAD_EXIGIR_CONSENTIMIENTO=true.
     */
    @Value("${app.privacidad.exigir-consentimiento:false}")
    private boolean exigirConsentimiento;

    public AuthResponse register(RegisterRequest registerRequest) {
        if (Credenciales.esClaveComun(registerRequest.getPassword())) {
            throw new IllegalArgumentException("Esa contraseña es de las primeras que prueba cualquiera. Elige otra.");
        }
        if (userRepository.existsByEmail(registerRequest.getEmail())) {
            log.warn("Intento de registro con email duplicado: {}", registerRequest.getEmail());
            throw new DuplicateResourceException("El email ya está registrado");
        }

        String roleName = "EMPRESA".equalsIgnoreCase(registerRequest.getUserType()) ? "EMPRESA" : "USER";
        List<Consentimiento> consentimientos = consentimientos(registerRequest, "USER".equals(roleName));

        User user = new User();
        user.setEmail(registerRequest.getEmail());
        user.setPassword(passwordEncoder.encode(registerRequest.getPassword()));
        user.setFirstName(registerRequest.getFirstName());
        user.setLastName(registerRequest.getLastName());
        user.setPhone(registerRequest.getPhone());
        user.setEnabled(true);
        user.setRoles(List.of(roleName));
        user.setConsentimientos(consentimientos);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());

        User savedUser = userRepository.save(user);

        String companyId = null;
        if ("EMPRESA".equals(roleName)) {
            companyId = createCompanyProfile(savedUser, registerRequest);
        }

        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                registerRequest.getEmail(),
                registerRequest.getPassword()
            )
        );

        String jwt = tokenProvider.generateToken(authentication);

        long expiresAt = System.currentTimeMillis() + tokenProvider.getExpirationMillis();
        log.info("Nuevo {} registrado: email={}, id={}", roleName, savedUser.getEmail(), savedUser.getId());
        AuthResponse response = new AuthResponse(jwt, savedUser.getId(), companyId, savedUser.getEmail(),
                savedUser.getFirstName(), savedUser.getLastName(), roleName);
        response.setExpiresAt(expiresAt);
        return response;
    }

    /**
     * Arma la prueba del consentimiento. Con exigirConsentimiento, sin aceptar la
     * política (y, si es persona, sin declarar mayoría de edad) no hay registro.
     */
    private List<Consentimiento> consentimientos(RegisterRequest request, boolean esPersona) {
        boolean politica = Boolean.TRUE.equals(request.getAceptaPolitica());
        boolean mayor = Boolean.TRUE.equals(request.getMayorDeEdad());
        if (exigirConsentimiento && !politica) {
            throw new IllegalArgumentException("Para crear la cuenta debes aceptar la política de tratamiento de datos.");
        }
        if (exigirConsentimiento && esPersona && !mayor) {
            throw new IllegalArgumentException("Para crear la cuenta debes ser mayor de edad.");
        }
        if (!politica) {
            log.warn("Registro sin consentimiento guardado: el frontend todavía no envía aceptaPolitica");
        }
        List<Consentimiento> lista = new ArrayList<>();
        LocalDateTime ahora = LocalDateTime.now();
        if (politica) lista.add(new Consentimiento(Consentimiento.POLITICA_DATOS, versionPolitica, ahora));
        if (mayor && esPersona) lista.add(new Consentimiento(Consentimiento.MAYOR_DE_EDAD, versionPolitica, ahora));
        return lista;
    }

    private String createCompanyProfile(User owner, RegisterRequest request) {
        Company company = new Company();
        company.setUserId(owner.getId());
        company.setName(request.getFirstName());
        company.setEmail(request.getEmail());
        company.setPhone(request.getPhone());
        company.setLocation("No especificada");
        company.setDescription("Bienvenido a " + request.getFirstName()
                + ". Edita esta sección para agregar información sobre tu empresa, misión, visión y valores.");
        company.setActive(true);
        company.setIsVerified(false);
        company.setCreatedAt(LocalDateTime.now());
        company.setUpdatedAt(LocalDateTime.now());
        return companyRepository.save(company).getId();
    }
}
