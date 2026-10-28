package com.skillmatch.backend.validation;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

/** Reglas de correo y contraseña que comparten el registro, el login y el perfil. */
public final class Credenciales {

    /** Dominio con punto y extensión: "ana@localhost" no vale. Para @Email(regexp = ...). */
    public static final String REGEX_CORREO = "^[^@\\s]+@[^@\\s]+\\.[A-Za-z]{2,}$";

    /** BCrypt solo usa los primeros 72 bytes, y Spring lanza un error si hay más. */
    public static final int MAX_CLAVE = 72;

    /** Cuentas creadas con Google: no tienen contraseña hasta que creen una. */
    public static final String SIN_CLAVE =
            "Tu cuenta no tiene contraseña (entraste con Google). Crea una con \"¿Olvidaste tu contraseña?\" y vuelve a intentarlo.";

    /** Las que cualquiera prueba primero (comparación exacta, sin mayúsculas ni tildes). */
    private static final Set<String> CLAVES_COMUNES = Set.of(
            "12345678", "123456789", "1234567890", "87654321", "11111111", "00000000",
            "password", "password1", "password123", "contrasena", "contrasena1", "contrasena123",
            "qwerty123", "qwertyuiop", "abc12345", "abcd1234", "admin123", "iloveyou", "teamo123",
            "skillmatch", "skillmatch1", "cartagena", "cartagena1", "colombia", "colombia1");

    private Credenciales() {
    }

    /** "  Ana@Correo.COM " -> "ana@correo.com": un mismo correo, una sola cuenta. */
    public static String normalizarCorreo(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    public static boolean esClaveComun(String clave) {
        if (clave == null) return false;
        String simple = Normalizer.normalize(clave.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return CLAVES_COMUNES.contains(simple);
    }
}
