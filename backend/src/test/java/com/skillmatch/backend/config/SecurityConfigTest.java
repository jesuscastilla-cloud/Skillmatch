package com.skillmatch.backend.config;

import com.skillmatch.backend.controller.JobController;
import com.skillmatch.backend.security.JwtAuthenticationEntryPoint;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.service.JobService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.io.FileInputStream;
import java.util.List;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * La configuración de seguridad real (cabeceras y CORS), con los filtros activos.
 * Usa una ruta pública cualquiera (/api/jobs/recent) para mirar la respuesta.
 */
@WebMvcTest(controllers = JobController.class)
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class})
@TestPropertySource(properties =
        "app.cors.allowed-origins=http://localhost:*,http://127.0.0.1:*,https://skillmatch-yz37.onrender.com")
class SecurityConfigTest {

    private static final String SITIO = "https://skillmatch-yz37.onrender.com";

    @Autowired private MockMvc mockMvc;

    @MockitoBean private JobService jobService;
    @MockitoBean private UserDetailsService userDetailsService;
    @MockitoBean private JwtTokenProvider jwtTokenProvider;

    @Test
    void cabecerasDeSeguridad() throws Exception {
        when(jobService.getRecentJobs()).thenReturn(List.of());

        mockMvc.perform(get("/api/jobs/recent"))
                .andExpect(status().isOk())
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"))
                .andExpect(header().string("Permissions-Policy",
                        "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)"))
                .andExpect(result -> assertThat(result.getResponse().getHeader("Content-Security-Policy"))
                        .contains("connect-src 'self';")
                        .doesNotContain("powerbi"));
    }

    @Test
    void cors_aceptaElDominioReal() throws Exception {
        mockMvc.perform(preflight(SITIO))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", SITIO));
    }

    @Test
    void cors_rechazaOtroSubdominioDeOnrender() throws Exception {
        mockMvc.perform(preflight("https://pagina-de-cualquiera.onrender.com"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void cors_porDefectoNoTieneComodines() throws Exception {
        Properties props = new Properties();
        try (FileInputStream in = new FileInputStream("src/main/resources/application.properties")) {
            props.load(in);
        }
        String cors = props.getProperty("app.cors.allowed-origins");

        assertThat(cors).contains(SITIO).doesNotContain("https://*.");
    }

    private org.springframework.test.web.servlet.RequestBuilder preflight(String origen) {
        return options("/api/jobs/recent")
                .header("Origin", origen)
                .header("Access-Control-Request-Method", "GET");
    }
}
