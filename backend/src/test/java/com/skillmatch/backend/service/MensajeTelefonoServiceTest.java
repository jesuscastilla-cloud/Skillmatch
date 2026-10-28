package com.skillmatch.backend.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Flow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class MensajeTelefonoServiceTest {

    private final HttpClient http = mock(HttpClient.class);

    @Test
    @SuppressWarnings("unchecked")
    void conTwilio_enviaElSmsAlNumero() throws Exception {
        HttpResponse<String> ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(201);
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(ok);
        MensajeTelefonoService sms = new MensajeTelefonoService(http, "AC123", "secreto", "+15005550006", "", "sms", false);

        assertThat(sms.enviar("+573001234567", "Tu código es 482913")).isTrue();

        ArgumentCaptor<HttpRequest> peticion = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(peticion.capture(), any(HttpResponse.BodyHandler.class));
        assertThat(peticion.getValue().uri().toString()).isEqualTo("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
        assertThat(cuerpo(peticion.getValue())).contains("To=%2B573001234567", "From=%2B15005550006", "482913");
    }

    @Test
    @SuppressWarnings("unchecked")
    void porWhatsapp_usaElPrefijoDelCanal() throws Exception {
        HttpResponse<String> ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(201);
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(ok);
        MensajeTelefonoService ws = new MensajeTelefonoService(http, "AC123", "secreto", "", "+14155238886", "whatsapp", false);

        ws.enviar("+573001234567", "Tu código es 482913");

        ArgumentCaptor<HttpRequest> peticion = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(peticion.capture(), any(HttpResponse.BodyHandler.class));
        assertThat(cuerpo(peticion.getValue())).contains("To=whatsapp%3A%2B573001234567", "From=whatsapp%3A%2B14155238886");
    }

    @Test
    void whatsappSinNumero_noCuentaComoConfigurado() {
        MensajeTelefonoService ws = new MensajeTelefonoService(http, "AC123", "secreto", "+15005550006", "", "whatsapp", false);

        assertThat(ws.configurado()).isFalse();
    }

    @Test
    void sinTwilioEnModoPrueba_noEnviaPeroResponde() {
        MensajeTelefonoService sms = new MensajeTelefonoService(http, "", "", "", "", "sms", true);

        assertThat(sms.disponible()).isTrue();
        assertThat(sms.enviar("+573001234567", "Tu código es 482913")).isTrue();
        verifyNoInteractions(http);
    }

    @Test
    void sinTwilioNiModoPrueba_noEstaDisponible() {
        MensajeTelefonoService sms = new MensajeTelefonoService(http, "", "", "", "", "sms", false);

        assertThat(sms.disponible()).isFalse();
        assertThat(sms.enviar("+573001234567", "x")).isFalse();
    }

    /** Lee el cuerpo form-urlencoded de la petición. */
    private static String cuerpo(HttpRequest peticion) {
        List<ByteBuffer> partes = new ArrayList<>();
        peticion.bodyPublisher().orElseThrow().subscribe(new Flow.Subscriber<>() {
            public void onSubscribe(Flow.Subscription s) { s.request(Long.MAX_VALUE); }
            public void onNext(ByteBuffer b) { partes.add(b); }
            public void onError(Throwable t) { }
            public void onComplete() { }
        });
        StringBuilder sb = new StringBuilder();
        partes.forEach(b -> sb.append(StandardCharsets.UTF_8.decode(b)));
        return sb.toString();
    }
}
