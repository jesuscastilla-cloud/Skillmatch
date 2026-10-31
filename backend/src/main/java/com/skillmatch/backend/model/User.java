package com.skillmatch.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

@Document(collection = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User implements UserDetails {

    @Id
    private String id;

    // Único entre las cuentas que lo tienen (índice parcial en MongoIndexConfig).
    // Puede faltar en cuentas creadas con teléfono (fase 9).
    private String email;

    // Nunca sale en un JSON, aunque alguien devuelva un User por error.
    // No afecta a MongoDB: Spring Data guarda el campo igual.
    @JsonIgnore
    private String password;

    private String firstName;

    private String lastName;

    // Formato internacional E.164 ("+573001234567"), único entre cuentas (ver Telefonos)
    private String phone;

    // true cuando confirmó el número con un código por SMS o WhatsApp (fase 9)
    private Boolean phoneVerified;

    private String headline;

    private String location;

    private String bio;

    private String profileImageUrl;

    private String coverImageUrl;

    private List<String> roles = new ArrayList<>();

    private List<Skill> skills = new ArrayList<>();

    private List<Experience> experiences = new ArrayList<>();

    private List<Education> educations = new ArrayList<>();

    private List<Certification> certifications = new ArrayList<>();

    private Boolean enabled = true;

    // Versión de las sesiones: cambiar la contraseña la sube y todos los
    // tokens con la versión anterior dejan de valer (ver JwtAuthenticationFilter)
    @JsonIgnore
    private Integer tokenVersion = 0;

    // La única sesión abierta (el identificador "jti" de su token). Entrar en otro
    // dispositivo lo reemplaza y la sesión anterior deja de valer (SesionUnicaService).
    // null en cuentas que no han vuelto a entrar desde este cambio: sus tokens siguen valiendo.
    @JsonIgnore
    private String sesionActiva;

    // Prueba de las autorizaciones aceptadas (Ley 1581). Ver RegistrationService.
    private List<Consentimiento> consentimientos = new ArrayList<>();

    // Última vez que entró: base para borrar cuentas inactivas (24 meses, fase 8)
    private LocalDateTime lastLoginAt;

    // true cuando probó que recibe correo en su dirección (código de registro o de
    // recuperación). Las cuentas anteriores a la fase 8 quedan en null.
    private Boolean emailVerified;

    // Identificador fijo que Google da a la persona ("sub"). No cambia aunque cambie
    // su correo de Google. null si nunca entró con Google.
    @JsonIgnore
    private String googleId;

    // Cuándo se le avisó que su cuenta inactiva se borrará (RetencionDatos). Entrar lo limpia.
    private LocalDateTime avisoInactividadEn;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .collect(Collectors.toList());
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return Boolean.TRUE.equals(enabled);
    }
}
