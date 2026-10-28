package com.skillmatch.backend.config;

import com.skillmatch.backend.security.GoogleLoginHandler;
import com.skillmatch.backend.security.IntencionGoogleResolver;
import com.skillmatch.backend.security.JwtAuthenticationEntryPoint;
import com.skillmatch.backend.security.JwtAuthenticationFilter;
import com.skillmatch.backend.security.RateLimitingFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

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

    /** Entrar con Google: apagado mientras falte alguna de las dos (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). */
    @Value("${app.google.client-id:}")
    private String googleClientId;

    @Value("${app.google.client-secret:}")
    private String googleClientSecret;

    @Value("${app.google.pagina-retorno:/pages/login.html}")
    private String googlePaginaRetorno;

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
            @Value("${app.rate-limit.max-requests:20}") int maxRequests,
            @Value("${app.rate-limit.trusted-proxies:1}") int trustedProxies) {
        return new RateLimitingFilter(enabled, maxRequests, trustedProxies);
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
                                           RateLimitingFilter rateLimitFilter,
                                           // @Lazy: el manejador usa el login, que sale de esta misma configuración
                                           @Lazy GoogleLoginHandler googleLoginHandler) throws Exception {
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
                // Al salir por un enlace externo, el otro sitio solo ve el dominio, no la URL
                .referrerPolicy(referrer -> referrer.policy(
                    ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                // Apaga lo que el sitio no usa; la ubicacion solo para el propio sitio
                // ("Vacantes cerca de ti")
                .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy",
                    "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)"))
                .contentSecurityPolicy(csp -> csp.policyDirectives(
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline'; " +
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                    "font-src 'self' data: https://fonts.gstatic.com; " +
                    // El frontend usa ui-avatars.com y unsplash.com para avatares y portadas
                    "img-src 'self' data: https:; " +
                    // El frontend va en el mismo dominio que la API: las paginas
                    // solo pueden mandar datos a su propio servidor
                    "connect-src 'self'; " +
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

        if (!googleClientId.isBlank() && !googleClientSecret.isBlank()) {
            // Las direcciones de Google (y la validación de su firma) ya vienen en Spring
            ClientRegistrationRepository registros = new InMemoryClientRegistrationRepository(
                    CommonOAuth2Provider.GOOGLE.getBuilder("google")
                            .clientId(googleClientId)
                            .clientSecret(googleClientSecret)
                            .build());
            http.oauth2Login(oauth -> oauth
                    .clientRegistrationRepository(registros)
                    .authorizedClientRepository(new SinGuardarTokensDeGoogle())
                    .authorizationEndpoint(ida -> ida.authorizationRequestResolver(new IntencionGoogleResolver(registros)))
                    // Sin esto Spring publica su propia página /login genérica
                    .loginPage(googlePaginaRetorno)
                    .successHandler(googleLoginHandler)
                    .failureHandler(googleLoginHandler));
        }

        http.authenticationProvider(authenticationProvider());
        http.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        // El límite va antes de los filtros de Google (que responden solos en /oauth2/... y
        // /login/oauth2/...) y, por lo tanto, también antes del JWT
        http.addFilterBefore(rateLimitFilter, OAuth2AuthorizationRequestRedirectFilter.class);

        return http.build();
    }

    /**
     * Spring guarda por defecto el token de acceso de Google para llamar a Google
     * después. Solo queremos saber quién es la persona: no se guarda nada.
     */
    static class SinGuardarTokensDeGoogle implements OAuth2AuthorizedClientRepository {
        @Override
        public <T extends OAuth2AuthorizedClient> T loadAuthorizedClient(String registrationId, Authentication principal,
                                                                         HttpServletRequest request) {
            return null;
        }

        @Override
        public void saveAuthorizedClient(OAuth2AuthorizedClient authorizedClient, Authentication principal,
                                         HttpServletRequest request, HttpServletResponse response) {
        }

        @Override
        public void removeAuthorizedClient(String registrationId, Authentication principal,
                                           HttpServletRequest request, HttpServletResponse response) {
        }
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
