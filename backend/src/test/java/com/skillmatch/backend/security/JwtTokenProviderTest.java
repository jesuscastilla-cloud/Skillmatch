package com.skillmatch.backend.security;

import com.skillmatch.backend.config.JwtProperties;
import com.skillmatch.backend.model.User;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtTokenProviderTest {

    static final String CLAVE_DE_PRUEBA = "clave-de-prueba-solo-para-tests-0123456789-abcdefghij";

    /** El último proveedor arrancado anota aquí la sesión de cada token (una sola por cuenta). */
    static SesionUnicaService sesionUnica;

    /** Crea el proveedor como lo haría Spring y ejecuta su revisión de arranque. */
    static JwtTokenProvider arrancar(String secreto, TokenBlacklistService blacklist) {
        JwtProperties props = new JwtProperties();
        props.setSecret(secreto);
        props.setExpiration(3_600_000L);
        JwtTokenProvider provider = new JwtTokenProvider();
        sesionUnica = mock(SesionUnicaService.class);
        ReflectionTestUtils.setField(provider, "jwtProperties", props);
        ReflectionTestUtils.setField(provider, "tokenBlacklistService", blacklist);
        ReflectionTestUtils.setField(provider, "sesionUnicaService", sesionUnica);
        ReflectionTestUtils.invokeMethod(provider, "init");
        return provider;
    }

    @Test
    void sinClave_noArranca() {
        assertThatThrownBy(() -> arrancar("", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("obligatoria");
    }

    @Test
    void claveDeEjemploPublicada_noArranca() {
        assertThatThrownBy(() -> arrancar("skillmatch-secreto-solo-para-desarrollo-local-no-usar-en-produccion", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ejemplo");
        assertThatThrownBy(() -> arrancar("cambia-esto-por-una-cadena-larga-y-aleatoria-de-mas-de-32-caracteres", null))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void clavePropia_arranca() {
        assertThatCode(() -> arrancar(CLAVE_DE_PRUEBA, null)).doesNotThrowAnyException();
    }

    @Test
    void elTokenLlevaLaVersionDeSesiones() {
        JwtTokenProvider provider = arrancar(CLAVE_DE_PRUEBA, null);
        User user = new User();
        user.setId("user-id-1");
        user.setEmail("ana@test.com");
        user.setRoles(List.of("USER"));
        user.setTokenVersion(3);

        String token = provider.generateToken(UserDetailsImpl.build(user));

        assertThat(provider.getTokenVersionFromJwt(token)).isEqualTo(3);
        assertThat(provider.getSubjectFromToken(token)).isEqualTo("user-id-1"); // el ID, no el correo
    }

    @Test
    void dosLoginsSeguidos_danTokensDistintos() {
        JwtTokenProvider provider = arrancar(CLAVE_DE_PRUEBA, null);
        User user = new User();
        user.setId("user-id-1");
        user.setEmail("ana@test.com");
        user.setRoles(List.of("USER"));
        UserDetailsImpl detalles = UserDetailsImpl.build(user);

        assertThat(provider.generateToken(detalles)).isNotEqualTo(provider.generateToken(detalles));
    }

    @Test
    void cadaTokenQuedaComoLaUnicaSesionDeLaCuenta() {
        JwtTokenProvider provider = arrancar(CLAVE_DE_PRUEBA, null);
        User user = new User();
        user.setId("user-id-1");
        user.setRoles(List.of("USER"));

        String token = provider.generateToken(UserDetailsImpl.build(user));

        String sesion = provider.getSessionIdFromJwt(token);
        assertThat(sesion).isNotBlank();
        verify(sesionUnica).registrar("user-id-1", sesion);
    }

    @Test
    void sesionActiva_soloValeLaUltima() {
        assertThat(SesionUnicaService.esLaActiva("s-2", "s-2")).isTrue();
        assertThat(SesionUnicaService.esLaActiva("s-2", "s-1")).isFalse();
        assertThat(SesionUnicaService.esLaActiva("s-2", null)).isFalse();
        // Cuenta que no ha vuelto a entrar desde este cambio: su token de antes sigue valiendo
        assertThat(SesionUnicaService.esLaActiva(null, "s-1")).isTrue();
    }

    @Test
    void tokenSinVersion_cuentaComoCero() {
        JwtTokenProvider provider = arrancar(CLAVE_DE_PRUEBA, null);
        // Token como los de antes de este cambio: sin el claim "ver"
        String tokenViejo = Jwts.builder()
                .subject("ana@test.com")
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(CLAVE_DE_PRUEBA.getBytes(StandardCharsets.UTF_8)))
                .compact();

        assertThat(provider.getTokenVersionFromJwt(tokenViejo)).isZero();
    }
}
