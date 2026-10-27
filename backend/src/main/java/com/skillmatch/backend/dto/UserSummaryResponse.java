package com.skillmatch.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Lo que se puede mostrar de una persona a otra (tarjetas, sugerencias).
 * Nunca lleva contraseña, correo, teléfono ni roles.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserSummaryResponse {
    private String id;
    private String firstName;
    private String lastName;
    private String headline;
    private String location;
    private String profileImageUrl;
    private List<String> skills;
}
