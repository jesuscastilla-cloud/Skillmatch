package com.skillmatch.backend.exception;

/** Otra operacion sobre lo mismo (el mismo proceso, la misma empresa) no termino a tiempo: 409, intentar de nuevo. */
public class OperacionEnCursoException extends RuntimeException {
    public OperacionEnCursoException(String mensaje) { super(mensaje); }
}
