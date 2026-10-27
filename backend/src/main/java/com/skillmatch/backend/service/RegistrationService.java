package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.RegisterRequest;
import com.skillmatch.backend.exception.DuplicateResourceException;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.Consentimiento;
import com.skillmatch.backend.model.RegistroPendiente;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.RegistroPendienteRepository;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.validation.Credenciales;
import com.skillmatch.backend.validation.ValidadorCorreo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Date;
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
    private final ValidadorCorreo validadorCorreo;
    private final RegistroPendienteRepository registrosPendientes;
    private final CodigoCorreoService codigos;
    private final CorreoService correo;

    /** Mensaje del registro con código: el mismo exista o no la cuenta (no revela quién está registrado). */
    public static final String MENSAJE_CODIGO_ENVIADO =
            "Te enviamos un código de 6 números a tu correo. Escríbelo para crear tu cuenta (vence en 15 minutos).";
    static final Duration VIGENCIA_PENDIENTE = Duration.ofMinutes(30);

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
        if (!validadorCorreo.puedeRecibir(registerRequest.getEmail())) {
            throw new IllegalArgumentException(ValidadorCorreo.MENSAJE);
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

    // ─── Registro con código (REGISTRO_VERIFICAR_CORREO=true) ────────────────

    /**
     * Paso 1: valida los datos y guarda un registro PENDIENTE (todavía no hay cuenta)
     * con la contraseña ya cifrada; envía un código al correo.
     *
     * Si el correo ya tiene cuenta, responde igual y le avisa a su dueño por correo:
     * desde fuera no se puede saber si un correo está registrado.
     */
    public void iniciarRegistro(RegisterRequest request) {
        if (Credenciales.esClaveComun(request.getPassword())) {
            throw new IllegalArgumentException("Esa contraseña es de las primeras que prueba cualquiera. Elige otra.");
        }
        if (!validadorCorreo.puedeRecibir(request.getEmail())) {
            throw new IllegalArgumentException(ValidadorCorreo.MENSAJE);
        }
        String roleName = "EMPRESA".equalsIgnoreCase(request.getUserType()) ? "EMPRESA" : "USER";
        List<Consentimiento> consentimientos = consentimientos(request, "USER".equals(roleName));

        if (userRepository.existsByEmail(request.getEmail())) {
            // El "código" solo sirve para no avisar más de una vez por minuto
            codigos.generar(request.getEmail(), "AVISO_CUENTA_EXISTENTE").ifPresent(x ->
                    correo.enviar(request.getEmail(), "Alguien intentó crear una cuenta con tu correo",
                            "Alguien intentó crear una cuenta nueva en SkillMatch con este correo, que ya tiene una.\n\n"
                            + "Si fuiste tú: inicia sesión o, si no recuerdas la contraseña, usa \"¿Olvidaste tu contraseña?\".\n"
                            + "Si no fuiste tú, puedes ignorar este correo: tu cuenta sigue igual."));
            return;
        }

        registrosPendientes.save(new RegistroPendiente(request.getEmail(), passwordEncoder.encode(request.getPassword()),
                request.getFirstName(), request.getLastName(), request.getPhone(), roleName, consentimientos,
                Date.from(Instant.now().plus(VIGENCIA_PENDIENTE))));
        enviarCodigoDeRegistro(request.getEmail(), request.getFirstName());
    }

    /** Paso 2: con el código correcto se crea la cuenta (ya verificada) y se abre la sesión. */
    public AuthResponse confirmarRegistro(String email, String codigo) {
        if (!codigos.verificar(email, CodigoCorreoService.REGISTRO, codigo)) {
            throw new IllegalArgumentException("El código no es correcto o ya venció. Pide uno nuevo.");
        }
        RegistroPendiente pendiente = registrosPendientes.findById(email)
                .orElseThrow(() -> new IllegalArgumentException("El registro venció. Vuelve a llenar el formulario."));
        if (userRepository.existsByEmail(email)) {
            throw new DuplicateResourceException("Ese correo ya tiene una cuenta. Inicia sesión.");
        }

        User user = new User();
        user.setEmail(pendiente.getEmail());
        user.setPassword(pendiente.getPasswordHash());
        user.setFirstName(pendiente.getFirstName());
        user.setLastName(pendiente.getLastName());
        user.setPhone(pendiente.getPhone());
        user.setEnabled(true);
        user.setEmailVerified(true);
        user.setRoles(List.of(pendiente.getUserType()));
        user.setConsentimientos(pendiente.getConsentimientos());
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        User savedUser = userRepository.save(user);
        registrosPendientes.deleteById(email);

        String companyId = null;
        if ("EMPRESA".equals(pendiente.getUserType())) {
            RegisterRequest datosEmpresa = new RegisterRequest(pendiente.getEmail(), null, pendiente.getFirstName(),
                    pendiente.getLastName(), pendiente.getPhone(), "EMPRESA");
            companyId = createCompanyProfile(savedUser, datosEmpresa);
        }

        String jwt = tokenProvider.generateToken(UserDetailsImpl.build(savedUser));
        log.info("Nuevo {} registrado con correo verificado: id={}", pendiente.getUserType(), savedUser.getId());
        AuthResponse response = new AuthResponse(jwt, savedUser.getId(), companyId, savedUser.getEmail(),
                savedUser.getFirstName(), savedUser.getLastName(), pendiente.getUserType());
        response.setExpiresAt(System.currentTimeMillis() + tokenProvider.getExpirationMillis());
        return response;
    }

    /** Otro código para un registro pendiente (uno por minuto). Responde igual siempre. */
    public void reenviarCodigo(String email) {
        registrosPendientes.findById(email).ifPresent(p -> enviarCodigoDeRegistro(email, p.getFirstName()));
    }

    private void enviarCodigoDeRegistro(String email, String nombre) {
        codigos.generar(email, CodigoCorreoService.REGISTRO).ifPresent(codigo ->
                correo.enviar(email, "Tu código para crear tu cuenta en SkillMatch",
                        "Hola " + nombre + ",\n\nTu código es: " + codigo + "\n\n"
                        + "Vence en 15 minutos. Si no estás creando una cuenta en SkillMatch, ignora este correo."));
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
