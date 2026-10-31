package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.CompanyResponse;
import com.skillmatch.backend.dto.DatosEmpresaRequest;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** "Editar datos" de Mi empresa: lo que el dueño puede cambiar de su empresa. */
@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class CompanyServiceDatosTest {

    @Mock private CompanyRepository companyRepository;
    @Mock private UserRepository userRepository;
    @Mock private JobService jobService;
    @Mock private ApplicationService applicationService;
    @Mock private MongoTemplate mongoTemplate;

    @InjectMocks
    private CompanyService companyService;

    private Company empresa;
    private User dueno;

    @BeforeEach
    void setUp() {
        empresa = new Company();
        empresa.setId("c-1");
        empresa.setUserId("u-1");
        empresa.setName("Hotel Viejo");
        empresa.setIndustry("Turismo");
        empresa.setIsVerified(false);
        empresa.setActive(true);
        dueno = new User();
        dueno.setId("u-1");
        dueno.setFirstName("Hotel Viejo");
        when(companyRepository.findById("c-1")).thenReturn(Optional.of(empresa));
        lenient().when(companyRepository.save(any(Company.class))).thenAnswer(i -> i.getArgument(0));
        lenient().when(userRepository.findById("u-1")).thenReturn(Optional.of(dueno));
    }

    @Test
    void cambiarNombre_tambienCambiaElDeLaCuenta() {
        DatosEmpresaRequest datos = new DatosEmpresaRequest();
        datos.setName("  Hotel   Puerta del Mar S.A.S. ");

        CompanyResponse r = companyService.actualizarDatos("c-1", datos);

        assertThat(r.getName()).isEqualTo("Hotel Puerta del Mar S.A.S.");
        assertThat(dueno.getFirstName()).isEqualTo("Hotel Puerta del Mar S.A.S.");
        verify(userRepository).save(dueno);
    }

    @Test
    void nombreConSimbolos_noSeGuarda() {
        DatosEmpresaRequest datos = new DatosEmpresaRequest();
        datos.setName("<b>Hotel</b>");

        assertThatThrownBy(() -> companyService.actualizarDatos("c-1", datos))
                .isInstanceOf(IllegalArgumentException.class);
        verify(companyRepository, never()).save(any());
    }

    @Test
    void nullNoCambia_vacioQuita_yTelefonoQuedaNormalizado() {
        DatosEmpresaRequest datos = new DatosEmpresaRequest();
        datos.setIndustry("");                // quita
        datos.setPhone("300 123 4567");       // se guarda como +57...
        datos.setFoundedYear(1998);
        datos.setWebsite("https://hotel.co"); // los demás quedan como estaban

        CompanyResponse r = companyService.actualizarDatos("c-1", datos);

        assertThat(r.getIndustry()).isNull();
        assertThat(r.getPhone()).isEqualTo("+573001234567");
        assertThat(r.getWebsite()).isEqualTo("https://hotel.co");
        assertThat(r.getName()).isEqualTo("Hotel Viejo");
        verify(userRepository, never()).save(any());
    }

    @Test
    void noPuedeVerificarseNiDesactivarseSola() {
        // El formulario no tiene esos campos: lo que el administrador decidió no cambia
        companyService.actualizarDatos("c-1", new DatosEmpresaRequest());

        assertThat(empresa.getIsVerified()).isFalse();
        assertThat(empresa.getActive()).isTrue();
    }

    @Test
    void anioCero_loQuita_yUnAnioFuturoNoVale() {
        empresa.setFoundedYear(2000);
        DatosEmpresaRequest datos = new DatosEmpresaRequest();
        datos.setFoundedYear(0);
        companyService.actualizarDatos("c-1", datos);
        assertThat(empresa.getFoundedYear()).isNull();

        DatosEmpresaRequest futuro = new DatosEmpresaRequest();
        futuro.setFoundedYear(java.time.Year.now().getValue() + 1);
        assertThat(futuro.isAnioValido()).isFalse();
    }
}
