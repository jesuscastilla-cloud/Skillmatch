package com.skillmatch.backend.service;

import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.UserRepository;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.validation.Credenciales;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Override
    @Transactional
    public UserDetails loadUserByUsername(String correoOId) throws UsernameNotFoundException {
        // Con "@" es un correo (login, y tokens anteriores a la fase 9); si no, el ID de la
        // cuenta (sujeto de los tokens nuevos; las cuentas de teléfono no tienen correo).
        String valor = correoOId == null ? "" : correoOId.trim();
        User user = (valor.contains("@")
                ? userRepository.findByEmail(Credenciales.normalizarCorreo(valor))
                : userRepository.findById(valor))
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado"));

        return UserDetailsImpl.build(user);
    }

    @Transactional
    public UserDetails loadUserById(@NonNull String id) {
        log.debug("Cargando usuario por id: {}", id);
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado con id: " + id));

        return UserDetailsImpl.build(user);
    }
}
