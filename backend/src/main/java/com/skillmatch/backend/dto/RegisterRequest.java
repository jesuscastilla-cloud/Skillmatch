package com.skillmatch.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {
    
    @NotBlank(message = "{validation.email.required}")
    @Email(message = "{validation.email.invalid}")
    private String email;

    @NotBlank(message = "{validation.password.required}")
    @Size(min = 8, message = "{validation.password.min}")
    private String password;

    @NotBlank(message = "{validation.firstName.required}")
    @Size(max = 100, message = "{validation.firstName.max}")
    private String firstName;

    @NotBlank(message = "{validation.lastName.required}")
    @Size(max = 100, message = "{validation.lastName.max}")
    private String lastName;

    @Size(max = 20, message = "{validation.phone.max}")
    private String phone;

    @NotBlank(message = "{validation.userType.required}")
    private String userType;
}
