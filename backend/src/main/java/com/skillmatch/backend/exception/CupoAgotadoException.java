package com.skillmatch.backend.exception;

/** La empresa llego al limite de su plan (invitaciones del mes, procesos abiertos o tamano del envio). */
public class CupoAgotadoException extends RuntimeException {
    public CupoAgotadoException(String mensaje) { super(mensaje); }
}
