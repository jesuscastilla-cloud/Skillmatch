package com.skillmatch.backend.service;

import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.validation.Credenciales;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * "Olvidé mi contraseña" con un código por correo.
 *
 * Pedir el código responde siempre lo mismo, exista o no la cuenta: así no se
 * puede averiguar quién está registrado.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecuperacionService {

    public static final String MENSAJE_ENVIADO =
            "Si ese correo tiene una cuenta en SkillMatch, te enviamos un código para cambiar la contraseña. Revisa también la carpeta de spam.";

    private final UserRepository userRepository;
    private final CodigoCorreoService codigos;
    private final CorreoService correo;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptService loginAttemptService;

    public void pedirCodigo(String email) {
        Optional<User> user = userRepository.findByEmail(email);
        if (user.isEmpty()) return; // misma respuesta, sin enviar nada
        codigos.generar(email, CodigoCorreoService.RECUPERAR_CLAVE).ifPresent(codigo ->
                correo.enviar(email, "Tu código para cambiar la contraseña de SkillMatch",
                        "Hola " + user.get().getFirstName() + ",\n\n"
                        + "Tu código es: " + codigo + "\n\n"
                        + "Vence en 15 minutos. Si no pediste cambiar tu contraseña, ignora este correo: tu cuenta sigue igual."));
    }

    /** Cambia la contraseña si el código es correcto. Cierra todas las sesiones abiertas. */
    public void cambiarClave(String email, String codigo, String claveNueva) {
        if (Credenciales.esClaveComun(claveNueva)) {
            throw new IllegalArgumentException("Esa contraseña es de las primeras que prueba cualquiera. Elige otra.");
        }
        if (!codigos.verificar(email, CodigoCorreoService.RECUPERAR_CLAVE, codigo)) {
            throw new IllegalArgumentException("El código no es correcto o ya venció. Pide uno nuevo.");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("El código no es correcto o ya venció. Pide uno nuevo."));
        user.setPassword(passwordEncoder.encode(claveNueva));
        user.setTokenVersion((user.getTokenVersion() == null ? 0 : user.getTokenVersion()) + 1);
        user.setEmailVerified(true); // acaba de probar que recibe correo ahí
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
        loginAttemptService.reset(email);
        log.info("Contraseña recuperada por código para usuario {} (sesiones anteriores cerradas)", user.getId());
    }
}
