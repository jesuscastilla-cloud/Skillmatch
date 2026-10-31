package com.skillmatch.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.skillmatch.backend.validation.EntradaSegura;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Year;

/**
 * Lo que el dueño de una empresa puede cambiar de su perfil (PATCH /api/companies/{id}).
 *
 * Cada campo es opcional: null deja el valor como estaba y "" quita los que no son
 * obligatorios. El correo sigue al de la cuenta y "verificada"/"activa" son del
 * administrador: por eso no están aquí.
 */
@Data
@NoArgsConstructor
public class DatosEmpresaRequest {

    /** Las reglas del nombre (letras, números y & . , ( )) las revisa Nombres en el servicio. */
    @Size(max = 100, message = "El nombre de la empresa puede tener hasta 100 caracteres")
    private String name;

    @Size(max = 60, message = "El sector puede tener hasta 60 caracteres")
    @Pattern(regexp = EntradaSegura.REGEX_LUGAR, message = "El sector solo puede tener letras, números, espacios y , . ( ) / -")
    private String industry;

    /** Las mismas claves que muestra el frontend (TAMANOS_EMPRESA). */
    @Pattern(regexp = "^$|micro|small|medium|large", message = "Elige el tamaño de la empresa de la lista")
    private String size;

    @Size(max = 100, message = "La ciudad puede tener hasta 100 caracteres")
    @Pattern(regexp = EntradaSegura.REGEX_LUGAR, message = EntradaSegura.MENSAJE_LUGAR)
    private String location;

    @Size(max = 200, message = "El sitio web puede tener hasta 200 caracteres")
    @Pattern(regexp = EntradaSegura.REGEX_ENLACE, message = "El sitio web debe empezar por http:// o https://")
    private String website;

    @Size(max = 25, message = "Ese número de teléfono no es válido")
    private String phone;

    /** Año de fundación; 0 lo quita. */
    @Min(value = 0, message = "El año de fundación no es válido")
    private Integer foundedYear;

    @Size(max = 2000, message = "Los beneficios pueden tener hasta 2000 caracteres")
    private String benefits;

    @Size(max = 5000, message = "La descripción puede tener hasta 5000 caracteres")
    private String description;

    @JsonIgnore
    @AssertTrue(message = "El año de fundación debe estar entre 1800 y este año.")
    public boolean isAnioValido() {
        return foundedYear == null || foundedYear == 0
                || (foundedYear >= 1800 && foundedYear <= Year.now().getValue());
    }
}
