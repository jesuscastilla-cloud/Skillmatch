package com.skillmatch.backend.service;

import com.skillmatch.backend.exception.DuplicateResourceException;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.validation.ValidadorCorreo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Cambiar el correo de la cuenta: solo con el código que llega al correo nuevo. */
@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class CambioCorreoServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private CodigoCorreoService codigos;
    @Mock private CorreoService correo;
    @Mock private ValidadorCorreo validadorCorreo;
    @Mock private CompanyService companyService;

    @InjectMocks
    private CambioCorreoService servicio;

    private User ana;

    @BeforeEach
    void setUp() {
        ana = new User();
        ana.setId("u-1");
        ana.setFirstName("Ana");
        ana.setEmail("ana@viejo.com");
        when(userRepository.findById("u-1")).thenReturn(Optional.of(ana));
        lenient().when(validadorCorreo.puedeRecibir(anyString())).thenReturn(true);
        lenient().when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void pedirCodigo_dejaElCorreoPendienteYLoEnviaAlNuevo() {
        when(codigos.generar("ana@nuevo.com", "CAMBIO_CORREO_u-1")).thenReturn(Optional.of("123456"));

        servicio.pedirCodigo("u-1", "  Ana@Nuevo.com ");

        assertThat(ana.getEmail()).isEqualTo("ana@viejo.com");          // todavía no cambia
        assertThat(ana.getCorreoPendiente()).isEqualTo("ana@nuevo.com");
        verify(correo).enviar(eq("ana@nuevo.com"), anyString(), contains("123456"));
    }

    @Test
    void correoQueYaTieneCuenta_mismaRespuestaYAvisoASuDueno() {
        when(userRepository.existsByEmail("pedro@x.com")).thenReturn(true);
        when(codigos.generar("pedro@x.com", "AVISO_CORREO_EN_USO")).thenReturn(Optional.of("x"));

        servicio.pedirCodigo("u-1", "pedro@x.com");

        verify(codigos, never()).generar("pedro@x.com", "CAMBIO_CORREO_u-1");
        verify(correo).enviar(eq("pedro@x.com"), contains("otra cuenta"), anyString());
    }

    @Test
    void mismoCorreo_oUnoQueNoRecibe_noSePide() {
        assertThatThrownBy(() -> servicio.pedirCodigo("u-1", "ana@viejo.com")).hasMessageContaining("Ese ya es");
        when(validadorCorreo.puedeRecibir("ana@desechable.com")).thenReturn(false);
        assertThatThrownBy(() -> servicio.pedirCodigo("u-1", "ana@desechable.com")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void confirmar_conElCodigo_cambiaElCorreoYAvisaAlAnterior() {
        ana.setCorreoPendiente("ana@nuevo.com");
        when(codigos.verificar("ana@nuevo.com", "CAMBIO_CORREO_u-1", "123456")).thenReturn(true);

        User r = servicio.confirmar("u-1", "123456");

        assertThat(r.getEmail()).isEqualTo("ana@nuevo.com");
        assertThat(r.getEmailVerified()).isTrue();
        assertThat(r.getCorreoPendiente()).isNull();
        verify(companyService).syncOwnerEmail("u-1", "ana@nuevo.com");
        verify(correo).enviar(eq("ana@viejo.com"), contains("Cambiaste el correo"), contains("ana@nuevo.com"));
    }

    @Test
    void confirmar_codigoMalo_noCambiaNada() {
        ana.setCorreoPendiente("ana@nuevo.com");
        when(codigos.verificar("ana@nuevo.com", "CAMBIO_CORREO_u-1", "000000")).thenReturn(false);

        assertThatThrownBy(() -> servicio.confirmar("u-1", "000000")).hasMessageContaining("no es correcto");
        assertThat(ana.getEmail()).isEqualTo("ana@viejo.com");
        verify(userRepository, never()).save(any());
    }

    @Test
    void confirmar_sinCorreoPendiente_noHaceNada() {
        assertThatThrownBy(() -> servicio.confirmar("u-1", "123456")).hasMessageContaining("no es correcto");
    }

    @Test
    void confirmar_siOtraCuentaTomoElCorreoMientrasTanto_noLoCambia() {
        ana.setCorreoPendiente("ana@nuevo.com");
        when(codigos.verificar("ana@nuevo.com", "CAMBIO_CORREO_u-1", "123456")).thenReturn(true);
        when(userRepository.existsByEmail("ana@nuevo.com")).thenReturn(true);

        assertThatThrownBy(() -> servicio.confirmar("u-1", "123456")).isInstanceOf(DuplicateResourceException.class);
        assertThat(ana.getEmail()).isEqualTo("ana@viejo.com");
    }
}
