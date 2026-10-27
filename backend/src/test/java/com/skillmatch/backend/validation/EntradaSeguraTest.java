package com.skillmatch.backend.validation;

import com.skillmatch.backend.dto.ConnectionRequest;
import com.skillmatch.backend.dto.JobRequest;
import com.skillmatch.backend.dto.MessageRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class EntradaSeguraTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void imagenesDelEditor_seAceptan() {
        assertThat(EntradaSegura.esImagenValida("data:image/webp;base64,UklGRiQAAABXRUJQ")).isTrue();
        assertThat(EntradaSegura.esImagenValida("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).isTrue();
        assertThat(EntradaSegura.esImagenValida("galeria:atardecer-bahia")).isTrue();
        assertThat(EntradaSegura.esImagenValida("https://ui-avatars.com/api/?name=Ana")).isTrue();
    }

    @Test
    void imagenesPeligrosas_seRechazan() {
        assertThat(EntradaSegura.esImagenValida("javascript:alert(1)")).isFalse();
        assertThat(EntradaSegura.esImagenValida("data:text/html;base64,PHNjcmlwdD4=")).isFalse();
        assertThat(EntradaSegura.esImagenValida("data:image/svg+xml;base64,PHN2Zz4=")).isFalse(); // un SVG puede llevar scripts
        assertThat(EntradaSegura.esImagenValida("http://servidor-ajeno.com/rastreo.gif")).isFalse();
        assertThat(EntradaSegura.esImagenValida("data:image/webp;base64," + "A".repeat(EntradaSegura.MAX_IMAGEN))).isFalse();
    }

    @Test
    void mensaje_adjuntoSoloEnlaceWeb_yContenidoConTope() {
        assertThat(validator.validate(new MessageRequest("u2", "Hola", "https://drive.google.com/x"))).isEmpty();
        assertThat(validator.validate(new MessageRequest("u2", "Hola", ""))).isEmpty();
        assertThat(validator.validate(new MessageRequest("u2", "Hola", null))).isEmpty();
        assertThat(validator.validate(new MessageRequest("u2", "Hola", "javascript:alert(1)"))).hasSize(1);
        assertThat(validator.validate(new MessageRequest("u2", "x".repeat(5001), null))).hasSize(1);
    }

    @Test
    void solicitudDeConexion_mensajeConTope() {
        assertThat(validator.validate(new ConnectionRequest("u2", "x".repeat(500)))).isEmpty();
        assertThat(validator.validate(new ConnectionRequest("u2", "x".repeat(501)))).hasSize(1);
    }

    @Test
    void vacante_listasConTope() {
        JobRequest job = new JobRequest();
        job.setCompanyId("c1");
        job.setTitle("Mesero");
        job.setType("empleo");
        job.setRequirements(Collections.nCopies(51, "Puntualidad"));
        assertThat(validator.validate(job)).hasSize(1);

        job.setRequirements(List.of("x".repeat(501)));
        assertThat(validator.validate(job)).hasSize(1);

        job.setRequirements(List.of("Atención al cliente"));
        assertThat(validator.validate(job)).isEmpty();
    }
}
