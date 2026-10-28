package com.skillmatch.backend.service;

import com.mongodb.client.result.DeleteResult;
import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.User;
import org.springframework.data.mongodb.core.query.Update;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class RetencionDatosTest {

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CorreoService correo = mock(CorreoService.class);
    private final DatosPersonalesService datosPersonales = mock(DatosPersonalesService.class);
    private final RetencionDatos retencion = new RetencionDatos(mongoTemplate, correo, datosPersonales);

    @Test
    void borraLasPostulacionesDeVacantesCerradasHaceMasDe12Meses() {
        ZoneId bogota = ZoneId.of("America/Bogota");
        retencion.setClock(Clock.fixed(Instant.parse("2026-10-27T08:00:00Z"), bogota));
        Job vieja = new Job();
        vieja.setId("job-viejo");
        when(mongoTemplate.find(any(Query.class), eq(Job.class))).thenReturn(List.of(vieja));
        when(mongoTemplate.remove(any(Query.class), eq(Application.class))).thenReturn(DeleteResult.acknowledged(3));

        retencion.borrarPostulacionesViejas();

        ArgumentCaptor<Query> vacantes = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(vacantes.capture(), eq(Job.class));
        org.bson.Document filtroFecha = (org.bson.Document) vacantes.getValue().getQueryObject().get("updatedAt");
        assertThat(filtroFecha.get("$lt")).isEqualTo(LocalDateTime.of(2025, 10, 27, 3, 0));

        ArgumentCaptor<Query> postulaciones = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).remove(postulaciones.capture(), eq(Application.class));
        org.bson.Document filtroJob = (org.bson.Document) postulaciones.getValue().getQueryObject().get("jobId");
        assertThat(filtroJob.get("$in")).isEqualTo(List.of("job-viejo"));
    }

    @Test
    void sinVacantesViejas_noBorraNada() {
        when(mongoTemplate.find(any(Query.class), eq(Job.class))).thenReturn(List.of());

        retencion.borrarPostulacionesViejas();

        verify(mongoTemplate, never()).remove(any(Query.class), eq(Application.class));
    }

    // ─── Cuentas inactivas ───────────────────────────────────────────────────

    @Test
    void sinCorreoConfigurado_noAvisaNiBorraNada() {
        when(correo.configurado()).thenReturn(false);

        retencion.cuentasInactivas();

        verifyNoInteractions(mongoTemplate, datosPersonales);
    }

    @Test
    void avisaPorCorreoYAnotaElAviso() {
        when(correo.configurado()).thenReturn(true);
        User inactiva = new User();
        inactiva.setId("u1");
        inactiva.setEmail("ana@correo.co");
        inactiva.setFirstName("Ana");
        when(mongoTemplate.find(any(Query.class), eq(User.class))).thenReturn(List.of(inactiva), List.of());
        when(correo.enviar(eq("ana@correo.co"), anyString(), anyString())).thenReturn(true);

        retencion.cuentasInactivas();

        verify(correo).enviar(eq("ana@correo.co"), contains("se eliminará"), contains("inicia sesión"));
        ArgumentCaptor<Update> aviso = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateFirst(any(Query.class), aviso.capture(), eq(User.class));
        assertThat(aviso.getValue().getUpdateObject().get("$set", org.bson.Document.class)).containsKey("avisoInactividadEn");
        verifyNoInteractions(datosPersonales);
    }

    @Test
    void siElCorreoFalla_noAnotaElAviso() {
        when(correo.configurado()).thenReturn(true);
        User inactiva = new User();
        inactiva.setId("u1");
        inactiva.setEmail("ana@correo.co");
        when(mongoTemplate.find(any(Query.class), eq(User.class))).thenReturn(List.of(inactiva), List.of());
        when(correo.enviar(anyString(), anyString(), anyString())).thenReturn(false);

        retencion.cuentasInactivas();

        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(Update.class), eq(User.class));
    }

    @Test
    void borraLasAvisadasQueNoVolvieron() {
        when(correo.configurado()).thenReturn(true);
        User avisada = new User();
        avisada.setId("u2");
        when(mongoTemplate.find(any(Query.class), eq(User.class))).thenReturn(List.of(), List.of(avisada));

        retencion.cuentasInactivas();

        verify(datosPersonales).borrarDatos(avisada);
    }
}
