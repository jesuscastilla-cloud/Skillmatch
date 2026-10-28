package com.skillmatch.backend.validation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillmatch.backend.dto.LoginRequest;
import com.skillmatch.backend.dto.RegisterRequest;
import com.skillmatch.backend.dto.UpdatePasswordRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CredencialesTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void elCorreoLlegaNormalizadoAlLeerElJson() throws Exception {
        LoginRequest login = json.readValue("{\"email\":\"  Ana@Correo.COM \",\"password\":\"Clave-123\"}", LoginRequest.class);
        RegisterRequest registro = json.readValue("{\"email\":\"Ana@Correo.COM\"}", RegisterRequest.class);

        assertThat(login.getEmail()).isEqualTo("ana@correo.com");
        assertThat(registro.getEmail()).isEqualTo("ana@correo.com");
    }

    @Test
    void correoSinDominioReal_noSirveParaRegistrarse() {
        assertThat(validator.validateProperty(registro("ana@localhost", "Clave-segura-1"), "email")).hasSize(1);
        assertThat(validator.validateProperty(registro("ana@correo.co", "Clave-segura-1"), "email")).isEmpty();
    }

    @Test
    void contrasenaDeMasDe72_noPasa() {
        assertThat(validator.validateProperty(registro("ana@correo.co", "x".repeat(73)), "password")).hasSize(1);
        assertThat(validator.validate(new UpdatePasswordRequest("actual", "x".repeat(73)))).hasSize(1);
        assertThat(validator.validate(new UpdatePasswordRequest("actual", "corta1"))).hasSize(1); // menos de 8
    }

    @Test
    void loginSigueAceptandoClavesDe6() {
        assertThat(validator.validate(new LoginRequest("ana@correo.co", "abc123"))).isEmpty();
    }

    @Test
    void clavesComunes_seDetectanSinImportarMayusculasNiTildes() {
        assertThat(Credenciales.esClaveComun("12345678")).isTrue();
        assertThat(Credenciales.esClaveComun("Contraseña")).isTrue();
        assertThat(Credenciales.esClaveComun("CARTAGENA")).isTrue();
        assertThat(Credenciales.esClaveComun("Bahia-de-Cartagena-2026")).isFalse();
    }

    private RegisterRequest registro(String email, String clave) {
        RegisterRequest r = new RegisterRequest();
        r.setEmail(email);
        r.setPassword(clave);
        r.setFirstName("Ana");
        r.setLastName("Prueba");
        r.setUserType("USER");
        return r;
    }
}
