package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.AuthResponse;
import com.skillmatch.backend.dto.RegisterRequest;
import com.skillmatch.backend.model.CanjeGoogle;
import com.skillmatch.backend.model.Consentimiento;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.security.TokenBlacklistService;
import com.skillmatch.backend.validation.Credenciales;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Date;
import java.util.List;

/**
 * Entrar con Google. Google ya comprobó quién es la persona; aquí se decide a qué
 * cuenta de SkillMatch corresponde (ver docs/AUDITORIA-BACKEND.md, fase 10).
 *
 * Funciona solo con GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET definidos.
 */
@Slf4j
@Service
public class GoogleAuthService {

    static final Duration VIGENCIA_CANJE = Duration.ofMinutes(1);
    private static final int MAX_NOMBRE = 100;
    private static final int MAX_FOTO = 500;
    private static final SecureRandom AZAR = new SecureRandom();

    private final boolean disponible;
    private final UserRepository userRepository;
    private final RegistrationService registrationService;
    private final AuthenticationService authenticationService;
    private final CorreoService correo;
    private final MongoTemplate mongoTemplate;

    public GoogleAuthService(@Value("${app.google.client-id:}") String clientId,
                             @Value("${app.google.client-secret:}") String clientSecret,
                             UserRepository userRepository,
                             RegistrationService registrationService,
                             AuthenticationService authenticationService,
                             CorreoService correo,
                             MongoTemplate mongoTemplate) {
        this.disponible = !clientId.isBlank() && !clientSecret.isBlank();
        this.userRepository = userRepository;
        this.registrationService = registrationService;
        this.authenticationService = authenticationService;
        this.correo = correo;
        this.mongoTemplate = mongoTemplate;
    }

    /** Lo que Google confirmó de la persona (del token de identidad firmado por Google). */
    public record DatosGoogle(String googleId, String email, Boolean emailVerificado,
                              String nombre, String apellido, String foto) {
    }

    /** Lo que eligió en la página antes de ir a Google: tipo de cuenta y casillas de la política. */
    public record Intencion(String tipo, boolean aceptaPolitica, boolean mayorDeEdad) implements java.io.Serializable {
        public static final Intencion NINGUNA = new Intencion("USER", false, false);
    }

    /** Motivo por el que no entra; viaja a la página de login (#google-error=...). */
    public static class GoogleRechazoException extends RuntimeException {
        private final String motivo;

        public GoogleRechazoException(String motivo, String mensaje) {
            super(mensaje);
            this.motivo = motivo;
        }

        public String getMotivo() {
            return motivo;
        }
    }

    public boolean disponible() {
        return disponible;
    }

    /** Busca la cuenta de esta persona: por su Google, luego por su correo; si no hay, la crea. */
    public User entrar(DatosGoogle datos, Intencion intencion) {
        if (!Boolean.TRUE.equals(datos.emailVerificado()) || datos.email() == null || datos.email().isBlank()) {
            throw new GoogleRechazoException("correo_no_verificado",
                    "Google no confirma que ese correo sea tuyo. Verifícalo en Google o regístrate con tu correo.");
        }
        String email = Credenciales.normalizarCorreo(datos.email());

        User user = userRepository.findByGoogleId(datos.googleId()).orElse(null);
        if (user == null) {
            user = userRepository.findByEmail(email).orElse(null);
            if (user != null) {
                revisarActiva(user);
                unir(user, datos.googleId());
            } else {
                user = crear(datos, email, intencion);
            }
        }
        revisarActiva(user);
        return user;
    }

    private void revisarActiva(User user) {
        if (!Boolean.TRUE.equals(user.getEnabled())) {
            throw new GoogleRechazoException("cuenta_desactivada", "Esta cuenta está desactivada.");
        }
    }

    /**
     * Une una cuenta que ya existía con su Google. Si la cuenta NUNCA probó que el correo
     * era suyo, pudo haberla creado otra persona con ese correo (pre-registro): se le
     * quita la contraseña y se cierran sus sesiones. El dueño real sigue entrando con
     * Google y puede crear una contraseña con "¿Olvidaste tu contraseña?".
     */
    private void unir(User user, String googleId) {
        boolean correoSinProbar = !Boolean.TRUE.equals(user.getEmailVerified());
        if (correoSinProbar && user.getPassword() != null) {
            user.setPassword(null);
            user.setTokenVersion((user.getTokenVersion() == null ? 0 : user.getTokenVersion()) + 1);
            log.warn("Cuenta {} unida a Google con correo sin verificar: contraseña quitada y sesiones cerradas", user.getId());
        }
        user.setGoogleId(googleId);
        user.setEmailVerified(true);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
        log.info("Cuenta {} unida a Google", user.getId());

        correo.enviar(user.getEmail(), "Tu cuenta de SkillMatch quedó unida a Google",
                "Hola " + user.getFirstName() + ",\n\nAcabas de entrar a SkillMatch con Google. Desde ahora puedes usar "
                + "el botón \"Continuar con Google\" para entrar.\n\n"
                + (correoSinProbar
                        ? "Como tu correo no estaba confirmado, por seguridad quitamos la contraseña anterior y cerramos "
                          + "las otras sesiones. Si quieres entrar también con contraseña, créala con \"¿Olvidaste tu contraseña?\".\n\n"
                        : "")
                + "Si no fuiste tú, cambia la contraseña de tu cuenta de Google y escríbenos.");
    }

    private User crear(DatosGoogle datos, String email, Intencion intencion) {
        String tipo = "EMPRESA".equalsIgnoreCase(intencion.tipo()) ? "EMPRESA" : "USER";

        // Las mismas reglas de consentimiento que el registro con correo
        RegisterRequest solicitud = new RegisterRequest();
        solicitud.setEmail(email);
        solicitud.setFirstName(recortar(datos.nombre(), email.substring(0, email.indexOf('@'))));
        solicitud.setLastName(recortar(datos.apellido(), ""));
        solicitud.setUserType(tipo);
        solicitud.setAceptaPolitica(intencion.aceptaPolitica());
        solicitud.setMayorDeEdad(intencion.mayorDeEdad());
        List<Consentimiento> consentimientos;
        try {
            consentimientos = registrationService.consentimientos(solicitud, "USER".equals(tipo));
        } catch (IllegalArgumentException e) {
            throw new GoogleRechazoException("consentimiento", e.getMessage());
        }

        User user = new User();
        user.setEmail(email);
        user.setFirstName(solicitud.getFirstName());
        user.setLastName(solicitud.getLastName());
        user.setGoogleId(datos.googleId());
        user.setEmailVerified(true);
        user.setEnabled(true);
        user.setRoles(List.of(tipo));
        user.setConsentimientos(consentimientos);
        if (datos.foto() != null && datos.foto().startsWith("https://") && datos.foto().length() <= MAX_FOTO) {
            user.setProfileImageUrl(datos.foto());
        }
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        User guardado = userRepository.save(user);

        if ("EMPRESA".equals(tipo)) {
            registrationService.createCompanyProfile(guardado, solicitud);
        }
        log.info("Nuevo {} registrado con Google: id={}", tipo, guardado.getId());
        return guardado;
    }

    private static String recortar(String texto, String siVacio) {
        String t = texto == null || texto.isBlank() ? siVacio : texto.trim();
        return t.length() > MAX_NOMBRE ? t.substring(0, MAX_NOMBRE) : t;
    }

    // ─── Código de un solo uso para el frontend ──────────────────────────────

    /** 32 bytes al azar; en la base solo queda su huella. */
    public String crearCanje(User user) {
        byte[] bytes = new byte[32];
        AZAR.nextBytes(bytes);
        String codigo = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        mongoTemplate.save(new CanjeGoogle(TokenBlacklistService.hash(codigo), user.getId(),
                Date.from(Instant.now().plus(VIGENCIA_CANJE))));
        return codigo;
    }

    /** Cambia el código por la sesión. Leer y borrar es UNA operación: no sirve dos veces. */
    public AuthResponse canjear(String codigo) {
        CanjeGoogle canje = mongoTemplate.findAndRemove(
                new Query(Criteria.where("_id").is(TokenBlacklistService.hash(codigo))), CanjeGoogle.class);
        // El TTL de MongoDB pasa cada minuto: el vencimiento se revisa también aquí
        if (canje == null || canje.getExpiresAt().before(new Date())) {
            throw new IllegalArgumentException("El acceso con Google venció. Vuelve a intentarlo.");
        }
        User user = userRepository.findById(canje.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("El acceso con Google venció. Vuelve a intentarlo."));
        revisarActiva(user);
        return authenticationService.sesionPara(user);
    }
}
