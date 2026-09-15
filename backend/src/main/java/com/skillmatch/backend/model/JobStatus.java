package com.skillmatch.backend.model;

public enum JobStatus {
    ABIERTA("abierta"),
    CERRADA("cerrada"),
    PAUSADA("pausada");

    private final String value;

    JobStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static JobStatus fromValue(String value) {
        if (value == null) return ABIERTA;
        for (JobStatus s : values()) {
            if (s.value.equalsIgnoreCase(value)) return s;
        }
        throw new IllegalArgumentException("Estado de job inválido: " + value);
    }
}
