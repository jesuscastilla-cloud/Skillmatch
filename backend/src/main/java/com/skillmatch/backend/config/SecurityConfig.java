package com.skillmatch.backend.config;

import com.skillmatch.backend.security.JwtAuthenticationEntryPoint;
import com.skillmatch.backend.security.JwtAuthenticationFilter;
import com.skillmatch.backend.security.RateLimitingFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final UserDetailsService userDetailsService;
    private final JwtAuthenticationEntryPoint unauthorizedHandler;

    /** Origenes permitidos para CORS, configurables con la variable ALLOWED_ORIGINS. */
    @Value("${app.cors.allowed-origins}")
    private String[] allowedOrigins;

    public SecurityConfig(UserDetailsService userDetailsService,
                          JwtAuthenticationEntryPoint unauthorizedHandler) {
        this.userDetailsService = userDetailsService;
        this.unauthorizedHandler = unauthorizedHandler;
    }

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter() {
        return new JwtAuthenticationFilter();
    }

    @Bean
    public RateLimitingFilter rateLimitingFilter(
            @Value("${app.rate-limit.enabled:true}") boolean enabled,
            @Value("${app.rate-limit.max-requests:20}") int maxRequests) {
        return new RateLimitingFilter(enabled, maxRequests);
    }

    /*
     * IMPORTANTE: Spring Boot registra automaticamente CUALQUIER bean de tipo Filter
     * en la cadena de filtros del servlet, ademas de la cadena de Spring Security.
     * Sin estos dos beans, JwtAuthenticationFilter y RateLimitingFilter se ejecutan
     * DOS VECES por peticion (el limite de intentos se agota al doble de velocidad
     * y el JWT se valida por duplicado). Aqui desactivamos el registro automatico.
     */
    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> disableAutoJwtFilter(JwtAuthenticationFilter filter) {
        FilterRegistrationBean<JwtAuthenticationFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public FilterRegistrationBean<RateLimitingFilter> disableAutoRateLimitFilter(RateLimitingFilter filter) {
        FilterRegistrationBean<RateLimitingFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           JwtAuthenticationFilter jwtFilter,
                                           RateLimitingFilter rateLimitFilter) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .exceptionHandling(exception -> exception.authenticationEntryPoint(unauthorizedHandler))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(headers -> headers
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000))
                .frameOptions(frame -> frame.disable())
                .contentTypeOptions(Customizer.withDefaults())
                .contentSecurityPolicy(csp -> csp.policyDirectives(
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline'; " +
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                    "font-src 'self' data: https://fonts.gstatic.com; " +
                    // El frontend usa ui-avatars.com y unsplash.com para avatares y portadas
                    "img-src 'self' data: https:; " +
                    // Permite que el frontend llame a la API aunque esten en dominios distintos
                    "connect-src 'self' https:; " +
                    "frame-src https://app.powerbi.com; " +
                    "frame-ancestors 'self'"
                ))
            )
            .authorizeHttpRequests(auth -> auth
                // Preflight CORS: siempre publico
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Healthcheck del hosting (Railway / Render)
                .requestMatchers("/api/health", "/health").permitAll()
                // Frontend estatico servido por el propio backend
                .requestMatchers(
                    "/", "/index.html",
                    "/pages/**", "/assets/**", "/src/**",
                    "/favicon.ico", "/_redirects",
                    "/*.html", "/*.css", "/*.js",
                    "/*.png", "/*.ico", "/*.jpg", "/*.svg", "/*.webp", "/*.json"
                ).permitAll()
                // API publica
                .requestMatchers(HttpMethod.POST, "/api/auth/logout").authenticated()
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/jobs/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/companies/**").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()
                .anyRequest().authenticated()
            );

        http.authenticationProvider(authenticationProvider());
        http.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterBefore(rateLimitFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // setAllowedOriginPatterns (no setAllowedOrigins) permite comodines
        // y es compatible con allowCredentials = true.
        configuration.setAllowedOriginPatterns(Arrays.asList(allowedOrigins));

        configuration.setAllowedMethods(Arrays.asList(
                "GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"
        ));

        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setExposedHeaders(Arrays.asList("Authorization", "Content-Type"));
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
