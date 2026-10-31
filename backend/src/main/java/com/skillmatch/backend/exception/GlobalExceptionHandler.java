package com.skillmatch.backend.exception;

import com.skillmatch.backend.dto.MessageResponse;
import com.skillmatch.backend.service.TelefonoAuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AccountStatusException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Manejador global de excepciones.
 *
 * ORDEN CRÍTICO: de más específico a más general.
 * Spring evalúa de arriba a abajo; si RuntimeException estuviera
 * primero capturaría todo antes de llegar a los handlers específicos.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // 1-2. Autenticación: usuario inexistente, contraseña mala o cuenta desactivada,
    // bloqueada o vencida responden IGUAL. Si no, se podría averiguar qué correos
    // tienen cuenta (enumeración). Spring revisa "desactivada" antes que la contraseña.
    @ExceptionHandler({UsernameNotFoundException.class, BadCredentialsException.class,
                       AccountStatusException.class})
    public ResponseEntity<?> handleBadCredentials(Exception ex, WebRequest request) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new MessageResponse("Email o contraseña incorrectos"));
    }

    // 3. ✅ FIX: Autorización — acceso denegado (faltaba completamente)
    // Sin este handler, Spring Security retorna 403 sin cuerpo JSON,
    // lo que rompe el parsing en el frontend.
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<?> handleAccessDenied(AccessDeniedException ex,
                                                 WebRequest request) {
        // Nuestros mensajes ya dicen por qué ("No puedes publicar vacantes a nombre de otra
        // empresa"); el de Spring cuando falla un @PreAuthorize es "Access Denied", en inglés
        String mensaje = ex.getMessage() == null || ex.getMessage().startsWith("Access Denied")
                ? "No tienes permiso para hacer esto."
                : ex.getMessage();
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse(mensaje));
    }

    // 4. Validación de campos (@Valid)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String field   = error instanceof FieldError campo ? campo.getField() : error.getObjectName();
            String message = error.getDefaultMessage();
            errors.put(field, message);
        });
        // Además, "message" con el primer problema: las pantallas leen ese campo y antes,
        // sin él, mostraban un "No se pudo crear la cuenta" sin decir qué faltaba
        if (!errors.isEmpty()) errors.put("message", errors.values().iterator().next());
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

    // Registro o entrada con teléfono sin habilitar (o sin proveedor de SMS): 503
    @ExceptionHandler(TelefonoAuthService.TelefonoNoDisponibleException.class)
    public ResponseEntity<?> handleTelefonoNoDisponible(TelefonoAuthService.TelefonoNoDisponibleException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new MessageResponse(ex.getMessage()));
    }

    // Demasiados intentos con una cuenta (bloqueo por fuerza bruta)
    @ExceptionHandler(TooManyAttemptsException.class)
    public ResponseEntity<?> handleTooManyAttempts(TooManyAttemptsException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(new MessageResponse(ex.getMessage()));
    }

    // Choque con un índice único (dos peticiones a la vez): sin el texto interno de MongoDB
    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<?> handleDuplicateKey(DuplicateKeyException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new MessageResponse("Ese registro ya existe"));
    }

    // JSON mal formado o un objeto donde se esperaba texto
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<?> handleNotReadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
                .body(new MessageResponse("Los datos enviados no tienen el formato esperado"));
    }

    // Ruta o archivo que no existe: 404 (antes salía 500)
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<?> handleNoResource(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new MessageResponse("No encontrado"));
    }

    // Errores de la base de datos: el detalle solo va al log
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<?> handleDataAccess(DataAccessException ex) {
        return errorInterno(ex);
    }

    // 9. Errores de negocio genéricos — SIEMPRE antes de Exception
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<?> handleRuntime(RuntimeException ex, WebRequest request) {
        // Solo los mensajes que escribimos nosotros llegan a la persona. Un fallo de
        // Java (NullPointerException, ClassCastException...) va al log con un código.
        boolean esNuestro = ex.getClass() == RuntimeException.class
                || ex.getClass() == IllegalArgumentException.class
                || ex.getClass().getName().startsWith("com.skillmatch.");
        if (!esNuestro) {
            return errorInterno(ex);
        }
        return ResponseEntity.badRequest()
                .body(new MessageResponse(ex.getMessage()));
    }

    // 8. Catch-all — último recurso
    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleGlobal(Exception ex, WebRequest request) {
        return errorInterno(ex);
    }

    /**
     * Error inesperado: la persona ve un mensaje genérico con un código; el
     * detalle (clase, mensaje y traza) queda solo en el log con ese mismo código.
     */
    private ResponseEntity<?> errorInterno(Exception ex) {
        String codigo = UUID.randomUUID().toString().substring(0, 8);
        log.error("Error interno [{}]", codigo, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new MessageResponse("Ocurrió un error. Intenta de nuevo; si sigue pasando, indica el código " + codigo + "."));
    }
}