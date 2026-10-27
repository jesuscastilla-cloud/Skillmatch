package com.skillmatch.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Envía los correos de SkillMatch (códigos de verificación, recuperación, avisos).
 *
 * - Con MAIL_USERNAME y MAIL_PASSWORD (Brevo): envía de verdad.
 * - Sin ellos y con CORREO_MODO_PRUEBA=true (solo en local): escribe el correo en el
 *   log, para probar sin cuenta de Brevo.
 * - Sin ellos y sin modo prueba: no envía nada y avisa en el log SIN el contenido
 *   (así un código nunca queda en los logs de producción).
 *
 * Texto plano, sin imágenes ni enlaces externos: llega mejor y no hay nada que falsificar.
 */
@Slf4j
@Service
public class CorreoService {

    private final ObjectProvider<JavaMailSender> mailSender;
    private final String usuarioSmtp;
    private final String remitente;
    private final boolean modoPrueba;

    public CorreoService(ObjectProvider<JavaMailSender> mailSender,
                         @Value("${spring.mail.username:}") String usuarioSmtp,
                         @Value("${app.correo.remitente:SkillMatch <no-responder@skillmatch.local>}") String remitente,
                         @Value("${app.correo.modo-prueba:false}") boolean modoPrueba) {
        this.mailSender = mailSender;
        this.usuarioSmtp = usuarioSmtp;
        this.remitente = remitente;
        this.modoPrueba = modoPrueba;
    }

    /** ¿Hay un servicio de correo configurado? (Sin él no se puede avisar antes de borrar cuentas). */
    public boolean configurado() {
        return usuarioSmtp != null && !usuarioSmtp.isBlank() && mailSender.getIfAvailable() != null;
    }

    /** Envía el correo. Devuelve false si no se pudo (el detalle queda en el log). */
    public boolean enviar(String para, String asunto, String texto) {
        if (!configurado()) {
            if (modoPrueba) {
                log.info("[CORREO DE PRUEBA, no se envió]\nPara: {}\nAsunto: {}\n{}", para, asunto, texto);
                return true;
            }
            log.warn("Correo no configurado (MAIL_USERNAME / MAIL_PASSWORD): no se envió '{}'", asunto);
            return false;
        }
        try {
            SimpleMailMessage mensaje = new SimpleMailMessage();
            mensaje.setFrom(remitente);
            mensaje.setTo(para);
            mensaje.setSubject(asunto);
            mensaje.setText(texto + "\n\n--\nSkillMatch Cartagena. Este correo se envió automáticamente; no lo respondas.");
            mailSender.getObject().send(mensaje);
            return true;
        } catch (MailException e) {
            log.error("No se pudo enviar el correo '{}': {}", asunto, e.getMessage());
            return false;
        }
    }
}
