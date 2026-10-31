package com.skillmatch.backend.service;

import com.skillmatch.backend.exception.DuplicateResourceException;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.validation.Credenciales;
import com.skillmatch.backend.validation.ValidadorCorreo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Cambiar el correo de la cuenta con un código.
 *
 * Antes, editar el perfil cambiaba el correo de una vez: con un error al escribirlo
 * la persona perdía el acceso, y "¿Olvidaste tu contraseña?" iba a un correo ajeno.
 * Ahora el correo nuevo queda pendiente hasta escribir el código que le llegó; al
 * confirmarlo, al correo anterior le llega un aviso.
 *
 * Pedir el código responde lo mismo aunque el correo ya tenga cuenta (a su dueño le
 * llega un aviso): desde una sesión tampoco se puede averiguar quién está registrado.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CambioCorreoService {

    public static final String MENSAJE_ENVIADO =
            "Te enviamos un código de 6 números al correo nuevo. Escríbelo para confirmar el cambio. Revisa también la carpeta de spam.";
    static final String CODIGO_INVALIDO = "El código no es correcto o ya venció. Pide uno nuevo.";

    private final UserRepository userRepository;
    private final CodigoCorreoService codigos;
    private final CorreoService correo;
    private final ValidadorCorreo validadorCorreo;
    private final CompanyService companyService;

    /** Paso 1: el correo nuevo queda pendiente y le llega un código. */
    public void pedirCodigo(String userId, String correoNuevo) {
        User user = cuenta(userId);
        String nuevo = Credenciales.normalizarCorreo(correoNuevo);
        if (nuevo == null || nuevo.isBlank()) throw new IllegalArgumentException("Escribe el correo nuevo.");
        if (nuevo.equals(user.getEmail())) throw new IllegalArgumentException("Ese ya es el correo de tu cuenta.");
        if (!validadorCorreo.puedeRecibir(nuevo)) throw new IllegalArgumentException(ValidadorCorreo.MENSAJE);

        user.setCorreoPendiente(nuevo);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        if (userRepository.existsByEmail(nuevo)) {
            // Misma respuesta; al dueño de ese correo, un aviso (como mucho uno por minuto)
            codigos.generar(nuevo, "AVISO_CORREO_EN_USO").ifPresent(x ->
                    correo.enviar(nuevo, "Alguien quiso usar tu correo en otra cuenta de SkillMatch",
                            "Alguien intentó cambiar el correo de otra cuenta de SkillMatch por este, que ya es el de tu cuenta.\n\n"
                            + "No cambió nada: tu cuenta sigue igual. Si no fuiste tú, puedes ignorar este correo."));
            return;
        }
        codigos.generar(nuevo, proposito(userId)).ifPresent(codigo ->
                correo.enviar(nuevo, "Tu código para cambiar el correo de SkillMatch",
                        "Hola " + user.getFirstName() + ",\n\nTu código es: " + codigo + "\n\n"
                        + "Vence en 15 minutos. Si no pediste cambiar el correo de tu cuenta en SkillMatch, ignora este correo."));
    }

    /** Paso 2: con el código correcto, el correo pendiente pasa a ser el de la cuenta (ya verificado). */
    public User confirmar(String userId, String codigo) {
        User user = cuenta(userId);
        String nuevo = user.getCorreoPendiente();
        if (nuevo == null || !codigos.verificar(nuevo, proposito(userId), codigo)) {
            throw new IllegalArgumentException(CODIGO_INVALIDO);
        }
        if (userRepository.existsByEmail(nuevo)) {
            // Alguien se registró con ese correo mientras tanto
            throw new DuplicateResourceException("Ese correo ya está en otra cuenta.");
        }
        String anterior = user.getEmail();
        user.setEmail(nuevo);
        user.setEmailVerified(true);
        user.setCorreoPendiente(null);
        user.setUpdatedAt(LocalDateTime.now());
        User guardado = userRepository.save(user);
        companyService.syncOwnerEmail(userId, nuevo);

        if (anterior != null) {
            correo.enviar(anterior, "Cambiaste el correo de tu cuenta de SkillMatch",
                    "Hola " + user.getFirstName() + ",\n\nEl correo de tu cuenta de SkillMatch ahora es " + nuevo + ".\n"
                    + "Desde ahora entras con ese correo y ahí te llegan los avisos.\n\n"
                    + "Si no fuiste tú, escríbenos de inmediato a skillmatchproject@gmail.com.");
        }
        log.info("Correo cambiado con código para usuario {}", userId);
        return guardado;
    }

    /** El código es del correo nuevo Y de esta cuenta: otra cuenta no puede usarlo. */
    static String proposito(String userId) {
        return "CAMBIO_CORREO_" + userId;
    }

    private User cuenta(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
    }
}
