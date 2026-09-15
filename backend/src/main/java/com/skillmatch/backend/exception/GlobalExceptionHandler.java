package com.skillmatch.backend.exception;

import com.skillmatch.backend.dto.MessageResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.HashMap;
import java.util.Map;

/**
 * Manejador global de excepciones.
 *
 * ORDEN CRÍTICO: de más específico a más general.
 * Spring evalúa de arriba a abajo; si RuntimeException estuviera
 * primero capturaría todo antes de llegar a los handlers específicos.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 1. Autenticación — usuario no encontrado
    @ExceptionHandler(UsernameNotFoundException.class)
    public ResponseEntity<?> handleUsernameNotFound(UsernameNotFoundException ex,
                                                     WebRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new MessageResponse(ex.getMessage()));
    }

    // 2. Autenticación — credenciales incorrectas
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<?> handleBadCredentials(BadCredentialsException ex,
                                                   WebRequest request) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new MessageResponse("Email o contraseña incorrectos"));
    }

    // 3. ✅ FIX: Autorización — acceso denegado (faltaba completamente)
    // Sin este handler, Spring Security retorna 403 sin cuerpo JSON,
    // lo que rompe el parsing en el frontend.
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<?> handleAccessDenied(AccessDeniedException ex,
                                                 WebRequest request) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new MessageResponse("Acceso denegado: " + ex.getMessage()));
    }

    // 4. Validación de campos (@Valid)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String field   = ((FieldError) error).getField();
            String message = error.getDefaultMessage();
            errors.put(field, message);
        });
        return ResponseEntity.badRequest().body(errors);
    }

    // 5. Tipo incorrecto en parámetros de URL (ej: /api/users/undefined)
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<?> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
                                                 WebRequest request) {
        Object rejected = ex.getValue();
        if ("undefined".equals(String.valueOf(rejected))) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse(
                            "Parámetro '" + ex.getName() + "' inválido. "
                            + "Verifica que el ID sea válido antes de llamar este endpoint."));
        }
        Class<?> requiredType = ex.getRequiredType();
        String typeName = requiredType != null ? requiredType.getSimpleName() : "tipo desconocido";
        return ResponseEntity.badRequest()
                .body(new MessageResponse(
                        "El parámetro '" + ex.getName() + "' debe ser " + typeName));
    }

    // 6. Recurso no encontrado (nuestro tipo custom)
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<?> handleResourceNotFound(ResourceNotFoundException ex,
                                                      WebRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new MessageResponse(ex.getMessage()));
    }

    // 7. Recurso duplicado (409)
    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<?> handleDuplicateResource(DuplicateResourceException ex,
                                                      WebRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new MessageResponse(ex.getMessage()));
    }

    // 8. Acceso no autorizado — dominio (403)
    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<?> handleUnauthorized(UnauthorizedException ex,
                                                 WebRequest request) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new MessageResponse(ex.getMessage()));
    }

    // 9. Errores de negocio genéricos — SIEMPRE antes de Exception
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<?> handleRuntime(RuntimeException ex, WebRequest request) {
        return ResponseEntity.badRequest()
                .body(new MessageResponse(ex.getMessage()));
    }

    // 8. Catch-all — último recurso
    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleGlobal(Exception ex, WebRequest request) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new MessageResponse("Error interno del servidor: " + ex.getMessage()));
    }
}