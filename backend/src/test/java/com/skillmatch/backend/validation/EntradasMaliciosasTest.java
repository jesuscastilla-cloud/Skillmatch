package com.skillmatch.backend.validation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;

import com.skillmatch.backend.controller.NotificationController;
import com.skillmatch.backend.dto.CertificationRequest;
import com.skillmatch.backend.dto.EducationRequest;
import com.skillmatch.backend.dto.ExperienceRequest;
import com.skillmatch.backend.dto.JobRequest;
import com.skillmatch.backend.dto.UpdateProfileRequest;
import com.skillmatch.backend.exception.GlobalExceptionHandler;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.NotificationService;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

/** Lo que un atacante probo contra el servidor local (Tarea 4) y que no debe volver a abrirse. */
class EntradasMaliciosasTest {

    private final Validator validador = Validation.buildDefaultValidatorFactory().getValidator();
    private static final String ETIQUETA = "<img src=x onerror=alert(1)>";

    // ---- Etiquetas HTML en textos cortos

    @Test
    void experiencia_rechazaEtiquetasEnEmpresaYCargo() {
        ExperienceRequest r = new ExperienceRequest();
        r.setCompany(ETIQUETA);
        r.setPosition("<b>Jefe</b>");
        r.setStartDate(LocalDate.of(2020, 1, 1));
        assertThat(validador.validate(r)).extracting(v -> v.getPropertyPath().toString())
                .contains("company", "position");
        r.setCompany("Hotel Bahía & Cía. (Cartagena)");
        r.setPosition("Auxiliar contable");
        assertThat(validador.validate(r)).isEmpty();
    }

    @Test
    void estudios_certificados_vacante_y_titular_rechazanEtiquetas() {
        EducationRequest e = new EducationRequest();
        e.setSchool(ETIQUETA); e.setDegree(ETIQUETA); e.setFieldOfStudy(ETIQUETA);
        e.setStartDate(LocalDate.of(2020, 1, 1));
        assertThat(validador.validate(e)).extracting(v -> v.getPropertyPath().toString())
                .contains("school", "degree", "fieldOfStudy");

        CertificationRequest c = new CertificationRequest();
        c.setName(ETIQUETA); c.setIssuer(ETIQUETA); c.setCredentialId(ETIQUETA);
        assertThat(validador.validate(c)).extracting(v -> v.getPropertyPath().toString())
                .contains("name", "issuer", "credentialId");

        JobRequest j = new JobRequest();
        j.setCompanyId("c-1"); j.setType("empleo"); j.setTitle(ETIQUETA); j.setDuration("<x>");
        assertThat(validador.validate(j)).extracting(v -> v.getPropertyPath().toString())
                .contains("title", "duration");

        UpdateProfileRequest p = new UpdateProfileRequest();
        p.setHeadline(ETIQUETA);
        assertThat(validador.validate(p)).extracting(v -> v.getPropertyPath().toString()).contains("headline");
    }

    // ---- Paginas: orden, tamano y numero de pagina

    private static final Set<String> CAMPOS = Set.of("name", "createdAt");

    @Test
    void paginas_ordenarPorUnCampoPrivadoOUnOperadorDeMongo_vuelveAlOrdenNormal() {
        Sort normal = Sort.by("name");
        for (String malo : List.of("$where", "password", "roles", "a.b", "")) {
            Pageable p = PageRequest.of(0, 10, Sort.by(malo.isEmpty() ? "x" : malo));
            assertThat(Paginas.segura(p, CAMPOS, normal).getSort()).isEqualTo(normal);
        }
        assertThat(Paginas.segura(PageRequest.of(0, 10, Sort.by("createdAt")), CAMPOS, normal).getSort())
                .isEqualTo(Sort.by("createdAt"));
        // Si uno de los campos pedidos no vale, no se acepta ninguno
        assertThat(Paginas.segura(PageRequest.of(0, 10, Sort.by("name", "password")), CAMPOS, normal).getSort())
                .isEqualTo(normal);
    }

    @Test
    void paginas_elTamanoNuncaPasaDe50_yLaPaginaNuncaEsNegativa() {
        Pageable p = Paginas.segura(PageRequest.of(5, 1_000_000), CAMPOS, Sort.by("name"));
        assertThat(p.getPageSize()).isEqualTo(Paginas.TAMANO_MAXIMO);
        assertThat(p.getPageNumber()).isEqualTo(5);
    }

    // ---- Errores de protocolo: el codigo correcto y nunca un 500

    @Test
    void erroresDeProtocolo_respondenConSuCodigo() {
        GlobalExceptionHandler h = new GlobalExceptionHandler();
        assertThat(h.handleMediaType(new HttpMediaTypeNotSupportedException("application/xml")).getStatusCode())
                .isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        assertThat(h.handleMethod(new HttpRequestMethodNotSupportedException("GET")).getStatusCode())
                .isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
        assertThat(h.handleMissingParam(new MissingServletRequestParameterException("keyword", "String")).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ---- Limpieza de notificaciones: no se puede pedir "mas nuevas que el futuro"

    @Test
    void cleanupDeNotificaciones_exigeDeUnoA365Dias() {
        NotificationService servicio = mock(NotificationService.class);
        NotificationController c = new NotificationController(servicio);
        UserDetailsImpl yo = mock(UserDetailsImpl.class);

        for (int mala : new int[] {-5, 0, 366, Integer.MAX_VALUE, Integer.MIN_VALUE}) {
            ResponseEntity<?> r = c.deleteOldNotifications(mala, yo);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }
        verify(servicio, never()).deleteOldNotifications(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt());
        assertThat(c.deleteOldNotifications(30, yo).getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
