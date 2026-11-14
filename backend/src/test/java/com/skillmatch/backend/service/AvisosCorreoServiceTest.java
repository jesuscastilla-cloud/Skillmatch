package com.skillmatch.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;

import com.skillmatch.backend.config.JwtProperties;
import com.skillmatch.backend.model.Application;
import com.skillmatch.backend.model.ApplicationStatus;
import com.skillmatch.backend.model.Job;
import com.skillmatch.backend.model.PreferenciasCorreo;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.AvisoEnviadoRepository;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.JobRepository;
import com.skillmatch.backend.repository.PreferenciasCorreoRepository;
import com.skillmatch.backend.repository.UserRepository;

class AvisosCorreoServiceTest {

    private final CorreoService correo = mock(CorreoService.class);
    private final NotificationService notificaciones = mock(NotificationService.class);
    private final ModeloPredictivoService modelo = mock(ModeloPredictivoService.class);
    private final PreferenciasCorreoRepository preferencias = mock(PreferenciasCorreoRepository.class);
    private final UserRepository usuarios = mock(UserRepository.class);
    private AvisosCorreoService avisos;
    private final User ana = new User();
    private final Application postulacion = new Application();
    private final Job vacante = new Job();

    @BeforeEach
    void preparar() {
        JwtProperties jwt = new JwtProperties();
        jwt.setSecret("secreto-de-prueba");
        avisos = new AvisosCorreoService(correo, notificaciones, modelo, preferencias,
                mock(AvisoEnviadoRepository.class), usuarios, mock(JobRepository.class),
                mock(CompanyRepository.class), mock(MongoTemplate.class), jwt, "https://sitio.test/", 400);
        ana.setId("u1");
        ana.setFirstName("Ana");
        ana.setEmail("ana@correo.co");
        postulacion.setId("p1");
        postulacion.setUserId("u1");
        vacante.setTitle("Auxiliar contable");
        when(usuarios.findById("u1")).thenReturn(Optional.of(ana));
        when(usuarios.existsById("u1")).thenReturn(true);
        when(preferencias.findById("u1")).thenReturn(Optional.empty());
        when(preferencias.save(any())).thenAnswer(i -> i.getArgument(0));
        when(correo.enviar(anyString(), anyString(), anyString())).thenReturn(true);
    }

    @Test
    void rechazada_mandaCampanitaYCorreoConConsejoYEnlaceDeBaja() {
        postulacion.setStatus(ApplicationStatus.RECHAZADA);
        when(modelo.consejoPara(postulacion)).thenReturn("Las postulaciones que traen carta suelen ser aceptadas más.");

        avisos.postulacionRespondida(postulacion, vacante);

        verify(notificaciones).createNotification(eq("u1"), eq("application_update"), anyString(), eq("p1"), anyString());
        ArgumentCaptor<String> texto = ArgumentCaptor.forClass(String.class);
        verify(correo).enviar(eq("ana@correo.co"), anyString(), texto.capture());
        assertThat(texto.getValue())
                .contains("Hola Ana")
                .contains("Un consejo para la próxima: Las postulaciones que traen carta")
                .contains("https://sitio.test/api/public/correos/baja?u=u1&k=respuesta&t=")
                .doesNotContain("%");                       // nunca un porcentaje para la persona
    }

    @Test
    void siLaPersonaApagoEseCorreo_soloLlegaLaCampanita() {
        PreferenciasCorreo p = new PreferenciasCorreo("u1");
        p.setRespuesta(false);
        when(preferencias.findById("u1")).thenReturn(Optional.of(p));
        postulacion.setStatus(ApplicationStatus.ACEPTADA);

        avisos.postulacionRespondida(postulacion, vacante);

        verify(notificaciones).createNotification(eq("u1"), anyString(), anyString(), eq("p1"), anyString());
        verify(correo, never()).enviar(anyString(), anyString(), anyString());
    }

    @Test
    void enlaceDeBaja_soloFuncionaConLaFirmaCorrecta() {
        String firma = avisos.firma("u1", PreferenciasCorreo.MENSAJES);

        assertThat(avisos.darseDeBaja("u1", PreferenciasCorreo.MENSAJES, "firma-falsa")).isFalse();
        assertThat(avisos.darseDeBaja("u1", PreferenciasCorreo.VACANTES, firma)).isFalse();   // firma de otro tipo
        assertThat(avisos.darseDeBaja("u1", PreferenciasCorreo.MENSAJES, firma)).isTrue();

        ArgumentCaptor<PreferenciasCorreo> guardada = ArgumentCaptor.forClass(PreferenciasCorreo.class);
        verify(preferencias).save(guardada.capture());
        assertThat(guardada.getValue().isMensajes()).isFalse();
        assertThat(guardada.getValue().isRespuesta()).isTrue();
    }

    @Test
    void topeDiario_dejaDeEnviarAlLlegar() {
        JwtProperties jwt = new JwtProperties();
        jwt.setSecret("x");
        AvisosCorreoService conTope = new AvisosCorreoService(correo, notificaciones, modelo, preferencias,
                mock(AvisoEnviadoRepository.class), usuarios, mock(JobRepository.class),
                mock(CompanyRepository.class), mock(MongoTemplate.class), jwt, "https://sitio.test", 1);
        postulacion.setStatus(ApplicationStatus.ACEPTADA);

        conTope.postulacionRespondida(postulacion, vacante);
        conTope.postulacionRespondida(postulacion, vacante);

        verify(correo, org.mockito.Mockito.times(1)).enviar(anyString(), anyString(), anyString());
    }
}
