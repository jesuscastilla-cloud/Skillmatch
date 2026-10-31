package com.skillmatch.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.skillmatch.backend.validation.EntradaSegura;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExperienceRequest {

    @NotBlank(message = "La empresa es obligatoria")
    @Size(max = 150, message = "La empresa no puede tener más de 150 caracteres")
    private String company;

    @NotBlank(message = "El cargo es obligatorio")
    @Size(max = 150, message = "El cargo no puede tener más de 150 caracteres")
    private String position;

    @NotNull(message = "La fecha de inicio es obligatoria")
    private LocalDate startDate;

    private LocalDate endDate;

    private Boolean isCurrent = false;

    @Size(max = 2000, message = "La descripción no puede tener más de 2000 caracteres")
    private String description;

    @Size(max = 100, message = "La ubicación no puede tener más de 100 caracteres")
    @Pattern(regexp = EntradaSegura.REGEX_LUGAR, message = EntradaSegura.MENSAJE_LUGAR)
    private String location;

    /** La primera fecha que se acepta: antes de esto es un error al escribir. */
    private static final LocalDate MAS_ANTIGUA = LocalDate.of(1950, 1, 1);

    @JsonIgnore
    @AssertTrue(message = "La fecha de inicio no puede ser en el futuro ni antes de 1950.")
    public boolean isInicioValido() {
        return startDate == null || (!startDate.isBefore(MAS_ANTIGUA) && !startDate.isAfter(LocalDate.now()));
    }

    @JsonIgnore
    @AssertTrue(message = "La fecha de fin no puede ser antes del inicio ni en el futuro.")
    public boolean isFinValido() {
        if (Boolean.TRUE.equals(isCurrent) || endDate == null) return true;
        return !endDate.isAfter(LocalDate.now()) && (startDate == null || !endDate.isBefore(startDate));
    }
}
