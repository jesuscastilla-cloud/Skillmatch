package com.skillmatch.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

/**
 * Envía códigos por SMS o WhatsApp usando Twilio (de pago: cobra por mensaje).
 *
 * - Con TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y el remitente del canal: envía.
 * - Sin ellos y con SMS_MODO_PRUEBA=true (solo en local): escribe el mensaje en el log.
 * - Sin ninguno: no envía y avisa SIN el contenido (ningún código en los logs).
 *
 * Todo pasa por aquí: cambiar de proveedor es cambiar solo esta clase.
 */
@Slf4j
@Service
public class MensajeTelefonoService {

    private static final String API = "https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json";

    private final HttpClient http;
    private final String accountSid;
    private final String authToken;
    private final String desdeSms;
    private final String desdeWhatsapp;
    private final String canal;
    private final boolean modoPrueba;

    @Autowired
    public MensajeTelefonoService(@Value("${app.telefono.twilio.account-sid:}") String accountSid,
                                  @Value("${app.telefono.twilio.auth-token:}") String authToken,
                                  @Value("${app.telefono.twilio.from:}") String desdeSms,
                                  @Value("${app.telefono.twilio.whatsapp-from:}") String desdeWhatsapp,
                                  @Value("${app.telefono.canal:sms}") String canal,
                                  @Value("${app.telefono.modo-prueba:false}") boolean modoPrueba) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build(),
                accountSid, authToken, desdeSms, desdeWhatsapp, canal, modoPrueba);
    }

    MensajeTelefonoService(HttpClient http, String accountSid, String authToken, String desdeSms,
                           String desdeWhatsapp, String canal, boolean modoPrueba) {
        this.http = http;
        this.accountSid = accountSid;
        this.authToken = authToken;
        this.desdeSms = desdeSms;
        this.desdeWhatsapp = desdeWhatsapp;
        this.canal = "whatsapp".equalsIgnoreCase(canal) ? "whatsapp" : "sms";
        this.modoPrueba = modoPrueba;
    }

    /** ¿Hay proveedor configurado para el canal elegido? */
    public boolean configurado() {
        String numero = "whatsapp".equals(canal) ? desdeWhatsapp : desdeSms;
        return !accountSid.isBlank() && !authToken.isBlank() && !numero.isBlank();
    }

    /** ¿Se pueden recibir códigos por teléfono (de verdad o en modo prueba)? */
    public boolean disponible() {
        return configurado() || modoPrueba;
    }

    /** Envía el texto al número (E.164). Devuelve false si no se pudo; el detalle va al log. */
    public boolean enviar(String telefonoE164, String texto) {
        if (!configurado()) {
            if (modoPrueba) {
                log.info("[{} DE PRUEBA, no se envió]\nPara: {}\n{}", canal.toUpperCase(), telefonoE164, texto);
                return true;
            }
            log.warn("Mensajes por teléfono no configurados (Twilio): no se envió el código");
            return false;
        }
        String para = "whatsapp".equals(canal) ? "whatsapp:" + telefonoE164 : telefonoE164;
        String cuerpo = "To=" + url(para) + "&From=" + url(remitente()) + "&Body=" + url(texto);
        HttpRequest peticion = HttpRequest.newBuilder(URI.create(String.format(API, accountSid)))
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", "Basic " + Base64.getEncoder().encodeToString(
                        (accountSid + ":" + authToken).getBytes(StandardCharsets.UTF_8)))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(cuerpo))
                .build();
        try {
            HttpResponse<String> respuesta = http.send(peticion, HttpResponse.BodyHandlers.ofString());
            if (respuesta.statusCode() / 100 == 2) return true;
            log.error("Twilio no envió el mensaje (HTTP {})", respuesta.statusCode());
            return false;
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.error("No se pudo contactar a Twilio: {}", e.getMessage());
            return false;
        }
    }

    private String remitente() {
        return "whatsapp".equals(canal) ? "whatsapp:" + desdeWhatsapp : desdeSms;
    }

    private static String url(String valor) {
        return URLEncoder.encode(valor, StandardCharsets.UTF_8);
    }
}
