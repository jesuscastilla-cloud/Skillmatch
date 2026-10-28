package com.skillmatch.backend.validation;

import com.google.i18n.phonenumbers.NumberParseException;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import com.google.i18n.phonenumbers.Phonenumber.PhoneNumber;

import java.util.Optional;

/**
 * Teléfonos en un solo formato: E.164 ("+573001234567"), el que necesita cualquier
 * proveedor de SMS y el que permite saber si dos cuentas usan el mismo número.
 * Usa libphonenumber (Google). Sin "+", se asume Colombia.
 */
public final class Telefonos {

    public static final String MENSAJE = "Ese número de teléfono no es válido. Escríbelo con el indicativo si no es de Colombia (+57...).";

    private static final PhoneNumberUtil UTIL = PhoneNumberUtil.getInstance();
    private static final String REGION_POR_DEFECTO = "CO";

    private Telefonos() {
    }

    /** "+57 300 123 4567", "300-123-4567" o "3001234567" -> "+573001234567". Vacío si no es un número real. */
    public static Optional<String> normalizar(String telefono) {
        if (telefono == null || telefono.isBlank()) return Optional.empty();
        try {
            PhoneNumber numero = UTIL.parse(telefono.trim(), REGION_POR_DEFECTO);
            if (!UTIL.isValidNumber(numero)) return Optional.empty();
            return Optional.of(UTIL.format(numero, PhoneNumberUtil.PhoneNumberFormat.E164));
        } catch (NumberParseException e) {
            return Optional.empty();
        }
    }

    /**
     * Para lo que llega en un formulario: vacío -> null (el teléfono es opcional);
     * escrito pero inválido -> IllegalArgumentException; válido -> E.164.
     */
    public static String normalizarOpcional(String telefono) {
        if (telefono == null || telefono.isBlank()) return null;
        return normalizar(telefono).orElseThrow(() -> new IllegalArgumentException(MENSAJE));
    }
}
