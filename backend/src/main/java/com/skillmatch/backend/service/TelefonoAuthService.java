package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.RegisterRequest;
import com.skillmatch.backend.dto.RegistroTelefonoRequest;
import com.skillmatch.backend.exception.DuplicateResourceException;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.model.Consentimiento;
import com.skillmatch.backend.model.RegistroPendiente;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.RegistroPendienteRepository;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.validation.Credenciales;
import com.skillmatch.backend.validation.Telefonos;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

/**
 * Registro y entrada con el celular y un código por SMS o WhatsApp (fase 9).
 *
 * Apagado con TELEFONO_HABILITADO=false (por defecto): enviar códigos cuesta y hoy no
 * hay proveedor. Funciona si está habilitado Y hay proveedor (o modo prueba en local).
 * Mismas reglas que el correo: sin cuentas a medias y sin revelar qué números tienen cuenta.
 */
@Slf4j
@Service
public class TelefonoAuthService {

    public static final String MENSAJE_CODIGO =
            "Si el número es correcto, te enviamos un código de 6 números por mensaje. Vence en 15 minutos.";
    static final String REGISTRO = "REGISTRO_TELEFONO";
    static final String ENTRAR = "ENTRAR_TELEFONO";
    static final String VERIFICAR = "VERIFICAR_TELEFONO";
    /** Los registros pendientes por teléfono se guardan con este prefijo en el id (no tienen correo). */
    static final String PREFIJO_PENDIENTE = "tel:";

    private final boolean habilitado;
    private final MensajeTelefonoService mensajes;
    private final CodigoCorreoService codigos;
    private final UserRepository userRepository;
    private final RegistroPendienteRepository registrosPendientes;
    private final RegistrationService registrationService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final MongoTemplate mongoTemplate;

    public TelefonoAuthService(@Value("${app.telefono.habilitado:false}") boolean habilitado,
                               MensajeTelefonoService mensajes, CodigoCorreoService codigos,
                               UserRepository userRepository, RegistroPendienteRepository registrosPendientes,
                               RegistrationService registrationService, PasswordEncoder passwordEncoder,
                               JwtTokenProvider tokenProvider, MongoTemplate mongoTemplate) {
        this.habilitado = habilitado;
        this.mensajes = mensajes;
        this.codigos = codigos;
        this.userRepository = userRepository;
        this.registrosPendientes = registrosPendientes;
        this.registrationService = registrationService;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.mongoTemplate = mongoTemplate;
    }

    /** ¿Se puede usar el teléfono para registrarse y entrar? (El frontend muestra u oculta el botón). */
    public boolean disponible() {
        return habilitado && mensajes.disponible();
    }

    // ─── Registro ────────────────────────────────────────────────────────────

    public void iniciarRegistro(RegistroTelefonoRequest request) {
        exigirDisponible();
        String telefono = Telefonos.normalizarOpcional(request.getPhone());
        if (telefono == null) throw new IllegalArgumentException(Telefonos.MENSAJE);
        if (Credenciales.esClaveComun(request.getPassword())) {
            throw new IllegalArgumentException("Esa contraseña es de las primeras que prueba cualquiera. Elige otra.");
        }
        RegisterRequest datos = new RegisterRequest(null, request.getPassword(), request.getFirstName(),
                request.getLastName(), telefono, "USER", request.getAceptaPolitica(), request.getMayorDeEdad());
        List<Consentimiento> consentimientos = registrationService.consentimientos(datos, true);

        // Si ya tiene cuenta: misma respuesta y sin enviar nada (un aviso por SMS cuesta)
        if (userRepository.existsByPhone(telefono)) return;

        registrosPendientes.save(new RegistroPendiente(PREFIJO_PENDIENTE + telefono,
                passwordEncoder.encode(request.getPassword()), request.getFirstName(), request.getLastName(),
                telefono, "USER", consentimientos, Date.from(Instant.now().plus(Duration.ofMinutes(30)))));
        enviarCodigo(telefono, REGISTRO, "Tu código para crear tu cuenta en SkillMatch es");
    }

    public AuthResponse confirmarRegistro(String telefonoEscrito, String codigo) {
        exigirDisponible();
        String telefono = normalizar(telefonoEscrito);
        if (!codigos.verificar(telefono, REGISTRO, codigo)) {
            throw new IllegalArgumentException("El código no es correcto o ya venció. Pide uno nuevo.");
        }
        RegistroPendiente pendiente = registrosPendientes.findById(PREFIJO_PENDIENTE + telefono)
                .orElseThrow(() -> new IllegalArgumentException("El registro venció. Vuelve a llenar el formulario."));
        if (userRepository.existsByPhone(telefono)) {
            throw new DuplicateResourceException("Ese número ya tiene una cuenta. Entra con él.");
        }

        User user = new User();
        user.setPhone(telefono);
        user.setPhoneVerified(true);
        user.setPassword(pendiente.getPasswordHash());
        user.setFirstName(pendiente.getFirstName());
        user.setLastName(pendiente.getLastName());
        user.setEnabled(true);
        user.setRoles(List.of("USER"));
        user.setConsentimientos(pendiente.getConsentimientos());
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        user.setLastLoginAt(LocalDateTime.now());
        User guardado = userRepository.save(user);
        registrosPendientes.deleteById(PREFIJO_PENDIENTE + telefono);
        log.info("Nueva persona registrada con teléfono verificado: id={}", guardado.getId());
        return sesion(guardado);
    }

    // ─── Entrar con código ───────────────────────────────────────────────────

    /** Envía el código solo si el número es de una cuenta con teléfono verificado. Responde igual siempre. */
    public void pedirCodigoEntrada(String telefonoEscrito) {
        exigirDisponible();
        String telefono = Telefonos.normalizar(telefonoEscrito).orElse(null);
        if (telefono == null) return;
        userRepository.findByPhone(telefono)
                .filter(u -> Boolean.TRUE.equals(u.getPhoneVerified()) && u.isEnabled())
                .ifPresent(u -> enviarCodigo(telefono, ENTRAR, "Tu código para entrar a SkillMatch es"));
    }

    public AuthResponse entrarConCodigo(String telefonoEscrito, String codigo) {
        exigirDisponible();
        String telefono = normalizar(telefonoEscrito);
        String error = "El código no es correcto o ya venció. Pide uno nuevo.";
        if (!codigos.verificar(telefono, ENTRAR, codigo)) throw new IllegalArgumentException(error);
        User user = userRepository.findByPhone(telefono)
                .filter(u -> Boolean.TRUE.equals(u.getPhoneVerified()) && u.isEnabled())
                .orElseThrow(() -> new IllegalArgumentException(error));
        mongoTemplate.updateFirst(new Query(Criteria.where("_id").is(user.getId())),
                new Update().set("lastLoginAt", LocalDateTime.now()).unset("avisoInactividadEn"), User.class);
        return sesion(user);
    }

    // ─── Agregar un teléfono a la cuenta ─────────────────────────────────────

    public void pedirCodigoVerificacion(String userId, String telefonoEscrito) {
        exigirDisponible();
        String telefono = normalizar(telefonoEscrito);
        if (userRepository.existsByPhoneAndIdNot(telefono, userId)) {
            throw new IllegalArgumentException("Ese número ya está en otra cuenta.");
        }
        enviarCodigo(telefono, VERIFICAR + ":" + userId, "Tu código para confirmar tu número en SkillMatch es");
    }

    public void confirmarTelefono(String userId, String telefonoEscrito, String codigo) {
        exigirDisponible();
        String telefono = normalizar(telefonoEscrito);
        if (!codigos.verificar(telefono, VERIFICAR + ":" + userId, codigo)) {
            throw new IllegalArgumentException("El código no es correcto o ya venció. Pide uno nuevo.");
        }
        if (userRepository.existsByPhoneAndIdNot(telefono, userId)) {
            throw new IllegalArgumentException("Ese número ya está en otra cuenta.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        user.setPhone(telefono);
        user.setPhoneVerified(true);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    // ─── Ayudantes ───────────────────────────────────────────────────────────

    private void exigirDisponible() {
        if (!disponible()) throw new TelefonoNoDisponibleException();
    }

    private static String normalizar(String telefono) {
        return Telefonos.normalizar(telefono).orElseThrow(() -> new IllegalArgumentException(Telefonos.MENSAJE));
    }

    private void enviarCodigo(String telefono, String proposito, String texto) {
        codigos.generar(telefono, proposito).ifPresent(codigo ->
                mensajes.enviar(telefono, texto + " " + codigo + ". Vence en 15 minutos. No lo compartas con nadie."));
    }

    private AuthResponse sesion(User user) {
        String jwt = tokenProvider.generateToken(UserDetailsImpl.build(user));
        AuthResponse response = new AuthResponse(jwt, user.getId(), null, user.getEmail(),
                user.getFirstName(), user.getLastName(), "USER");
        response.setExpiresAt(System.currentTimeMillis() + tokenProvider.getExpirationMillis());
        return response;
    }

    /** El teléfono no está habilitado (o no hay proveedor): 503. */
    public static class TelefonoNoDisponibleException extends RuntimeException {
        public TelefonoNoDisponibleException() {
            super("Todavía no se puede usar el teléfono para registrarse o entrar. Usa tu correo.");
        }
    }
}
