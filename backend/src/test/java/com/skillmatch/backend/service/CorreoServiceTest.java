package com.skillmatch.backend.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CorreoServiceTest {

    @SuppressWarnings("unchecked")
    private final ObjectProvider<JavaMailSender> proveedor = mock(ObjectProvider.class);
    private final JavaMailSender sender = mock(JavaMailSender.class);

    @Test
    void conBrevo_enviaElCorreo() {
        when(proveedor.getIfAvailable()).thenReturn(sender);
        when(proveedor.getObject()).thenReturn(sender);
        CorreoService correo = new CorreoService(proveedor, "usuario@smtp-brevo.com", "SkillMatch <no-responder@x.co>", false);

        assertThat(correo.enviar("ana@correo.co", "Tu código", "123456")).isTrue();

        ArgumentCaptor<SimpleMailMessage> enviado = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(enviado.capture());
        assertThat(enviado.getValue().getTo()).containsExactly("ana@correo.co");
        assertThat(enviado.getValue().getText()).contains("123456");
    }

    @Test
    void sinBrevoEnModoPrueba_noEnviaPeroResponde() {
        CorreoService correo = new CorreoService(proveedor, "", "SkillMatch", true);

        assertThat(correo.configurado()).isFalse();
        assertThat(correo.enviar("ana@correo.co", "Tu código", "123456")).isTrue();
        verifyNoInteractions(sender);
    }

    @Test
    void sinBrevoNiModoPrueba_noEnvia() {
        CorreoService correo = new CorreoService(proveedor, "", "SkillMatch", false);

        assertThat(correo.enviar("ana@correo.co", "Tu código", "123456")).isFalse();
    }

    @Test
    void siBrevoFalla_devuelveFalseSinRomper() {
        when(proveedor.getIfAvailable()).thenReturn(sender);
        when(proveedor.getObject()).thenReturn(sender);
        doThrow(new MailSendException("timeout")).when(sender).send(any(SimpleMailMessage.class));
        CorreoService correo = new CorreoService(proveedor, "usuario@smtp-brevo.com", "SkillMatch", false);

        assertThat(correo.enviar("ana@correo.co", "Tu código", "123456")).isFalse();
    }
}
