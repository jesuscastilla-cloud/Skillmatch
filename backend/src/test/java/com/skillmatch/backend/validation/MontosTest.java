package com.skillmatch.backend.validation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.skillmatch.backend.dto.CompanyRequest;
import com.skillmatch.backend.dto.JobRequest;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

/** Las cifras que alguien malicioso (o un descuido) puede mandar en los salarios y el ano. */
class MontosTest {

    private final Validator validador = Validation.buildDefaultValidatorFactory().getValidator();

    private JobRequest vacante(Double minimo, Double maximo) {
        JobRequest r = new JobRequest();
        r.setCompanyId("empresa-1");
        r.setTitle("Mesero");
        r.setType("empleo");
        r.setSalaryMin(minimo);
        r.setSalaryMax(maximo);
        return r;
    }

    private List<String> errores(Object objeto) {
        Set<ConstraintViolation<Object>> v = validador.validate(objeto);
        return v.stream().map(ConstraintViolation::getMessage).toList();
    }

    @Test
    void sinSalario_ySalariosNormales_valen() {
        assertThat(errores(vacante(null, null))).isEmpty();
        assertThat(errores(vacante(1_800_000d, 2_500_000d))).isEmpty();
        assertThat(errores(vacante(1_800_000d, 1_800_000d))).isEmpty();
        assertThat(errores(vacante(null, 3_000_000d))).isEmpty();
        assertThat(errores(vacante(1d, 50_000_000d))).isEmpty();
    }

    @Test
    void elCero_losNegativos_yLosDecimales_noValen() {
        assertThat(errores(vacante(0d, 0d))).contains(Montos.MENSAJE_SALARIO);
        assertThat(errores(vacante(0d, null))).contains(Montos.MENSAJE_SALARIO);
        assertThat(errores(vacante(-1d, null))).contains(Montos.MENSAJE_SALARIO);
        assertThat(errores(vacante(1_800_000.5, null))).contains(Montos.MENSAJE_SALARIO);
        assertThat(errores(vacante(0.01, null))).contains(Montos.MENSAJE_SALARIO);
    }

    @Test
    void lasCifrasEnormes_noValen() {
        assertThat(errores(vacante(null, 50_000_001d))).contains(Montos.MENSAJE_SALARIO);
        assertThat(errores(vacante(null, 1e308))).contains(Montos.MENSAJE_SALARIO);
        assertThat(errores(vacante(null, Double.MAX_VALUE))).contains(Montos.MENSAJE_SALARIO);
        assertThat(errores(vacante(null, Double.POSITIVE_INFINITY))).contains(Montos.MENSAJE_SALARIO);
        assertThat(errores(vacante(Double.NaN, null))).contains(Montos.MENSAJE_SALARIO);
    }

    @Test
    void elMinimoNoPuedeSerMayorQueElMaximo() {
        assertThat(errores(vacante(3_000_000d, 2_000_000d)))
                .contains("El salario máximo no puede ser menor que el mínimo.");
    }

    @Test
    void elAnioDeFundacion_tieneRango() {
        CompanyRequest c = new CompanyRequest();
        c.setFoundedYear(1799);
        assertThat(errores(c)).contains("El año de fundación debe estar entre 1800 y este año.");
        c.setFoundedYear(java.time.Year.now().getValue() + 1);
        assertThat(errores(c)).contains("El año de fundación debe estar entre 1800 y este año.");
        c.setFoundedYear(-5);
        assertThat(errores(c)).contains("El año de fundación debe estar entre 1800 y este año.");
        c.setFoundedYear(2010);
        assertThat(errores(c)).doesNotContain("El año de fundación debe estar entre 1800 y este año.");
    }

    @Test
    void losFiltros_rechazanNegativosYEnormes_yAceptanVacioYElCero() {
        Montos.exigirSalarioDeFiltro("mínimo", null);
        Montos.exigirSalarioDeFiltro("mínimo", 0d);
        Montos.exigirSalarioDeFiltro("máximo", 50_000_000d);
        assertThatThrownBy(() -> Montos.exigirSalarioDeFiltro("mínimo", -1d)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Montos.exigirSalarioDeFiltro("máximo", 1e12)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Montos.exigirSalarioDeFiltro("máximo", Double.NaN)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void elTextoDeLosPesos_nuncaSaleEnNotacionCientifica() {
        assertThat(Montos.pesos(1_800_000)).isEqualTo("$1.800.000");
        assertThat(Montos.pesos(50_000_000)).isEqualTo("$50.000.000");
        assertThat(Montos.pesos(1e10)).doesNotContain("E");
    }
}
