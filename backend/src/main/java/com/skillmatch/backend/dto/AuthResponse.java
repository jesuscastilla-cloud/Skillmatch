package com.skillmatch.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class AuthResponse {

    // El token viaja SOLO en la cookie httpOnly que pone el controlador (AuthCookieService):
    // en el cuerpo solo serviría para que un script ajeno lo leyera (auditoría B1). El
    // frontend dejó de usarlo con F4; el navegador guarda solo expiresAt.
    @JsonIgnore
    private String token;
    @JsonIgnore
    private String type = "Bearer";
    private String id;
    private String companyId;
    private String email;
    private String firstName;
    private String lastName;
    private String role;
    private Long expiresAt;

    public AuthResponse(String token, String userId, String companyId, String email,
                        String firstName, String lastName, String role) {
        this.token = token;
        this.id = userId;
        this.companyId = companyId;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.role = role;
    }

    public AuthResponse(String token, String userId, String email, String firstName, String lastName) {
        this(token, userId, null, email, firstName, lastName, null);
    }
}
