package com.skillmatch.backend.model;

public enum ApplicationStatus {
    PENDIENTE("pendiente"),
    REVISADA("revisada"),
    ACEPTADA("aceptada"),
    RECHAZADA("rechazada"),
    /** La persona la retiro: queda guardada, pero ni ella ni la empresa la ven en sus listas. */
    RETIRADA("retirada");

    private final String value;

    ApplicationStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static ApplicationStatus fromValue(String value) {
        if (value == null) return PENDIENTE;
        for (ApplicationStatus s : values()) {
            if (s.value.equalsIgnoreCase(value)) return s;
        }
        throw new IllegalArgumentException("Estado de postulación inválido: " + value);
    }
}
