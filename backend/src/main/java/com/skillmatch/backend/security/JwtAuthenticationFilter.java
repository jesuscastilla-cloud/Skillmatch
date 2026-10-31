package com.skillmatch.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.lang.NonNull;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.security.authentication.DisabledException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private AuthCookieService authCookieService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String jwt = getJwtFromRequest(request);

        if (!StringUtils.hasText(jwt)) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            if (!tokenProvider.validateToken(jwt)) {
                throw new BadCredentialsException("Token vencido o mal firmado");
            }
            String sujeto = tokenProvider.getSubjectFromToken(jwt);
            UserDetails userDetails = userDetailsService.loadUserByUsername(sujeto);
            // La cuenta y sus roles se leen de la base en cada petición, no del token:
            // así desactivar una cuenta o quitarle un rol surte efecto de inmediato.
            if (!userDetails.isEnabled()) {
                throw new DisabledException("Cuenta desactivada");
            }
            // Cambiar la contraseña sube la versión: los tokens anteriores dejan de valer
            if (userDetails instanceof UserDetailsImpl user
                    && tokenProvider.getTokenVersionFromJwt(jwt) != user.getTokenVersion()) {
                throw new CredentialsExpiredException("Token de una versión anterior");
            }
            // Una sola sesión por cuenta: si entró en otro dispositivo, esta ya no vale
            if (userDetails instanceof UserDetailsImpl user
                    && !SesionUnicaService.esLaActiva(user.getSesionActiva(), tokenProvider.getSessionIdFromJwt(jwt))) {
                request.setAttribute(SesionUnicaService.ATRIBUTO_REEMPLAZADA, Boolean.TRUE);
                throw new CredentialsExpiredException("Sesión reemplazada por una más nueva");
            }
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (Exception ex) {
            // Un token que no vale (vencido, de antes de cambiar la contraseña, cuenta
            // desactivada) se trata como si no hubiera: la petición sigue SIN sesión. Las
            // rutas que la exigen responden 401 igual (JwtAuthenticationEntryPoint); las
            // páginas públicas cargan. Antes se cortaba aquí con 401 y una cookie vieja
            // dejaba todo el sitio (hasta index.html) mostrando un error.
            logger.warn("{}: {} — path: {}", ex.getClass().getSimpleName(), ex.getMessage(), request.getRequestURI());
            SecurityContextHolder.clearContext();
            if (vinoEnCookie(request)) {
                // Que el navegador deje de mandarla
                authCookieService.clearAuthCookie(response);
            }
        }

        filterChain.doFilter(request, response);
    }

    private static boolean vinoEnCookie(HttpServletRequest request) {
        String cabecera = request.getHeader("Authorization");
        return !(StringUtils.hasText(cabecera) && cabecera.startsWith("Bearer "));
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        if (request.getCookies() != null) {
            for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                if ("auth_token".equals(cookie.getName()) && StringUtils.hasText(cookie.getValue())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
