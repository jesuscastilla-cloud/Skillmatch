package com.skillmatch.backend.exception;

/** Demasiados intentos fallidos con una cuenta: responde 429 (GlobalExceptionHandler). */
public class TooManyAttemptsException extends RuntimeException {

    public TooManyAttemptsException(String message) {
        super(message);
    }
}
