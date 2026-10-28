package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.CompanyResponse;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.security.UserDetailsImpl;
import com.skillmatch.backend.service.CompanyService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = CompanyController.class)
@AutoConfigureMockMvc(addFilters = false)
class CompanyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CompanyService companyService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void getCompany_existingId_returnsCompany() throws Exception {
        CompanyResponse company = new CompanyResponse();
        company.setId("company-1");
        company.setName("TechCorp");

        when(companyService.getCompanyById("1")).thenReturn(company);

        mockMvc.perform(get("/api/companies/1").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("company-1"))
                .andExpect(jsonPath("$.name").value("TechCorp"));
    }

    @Test
    void getCompany_notFound_returns404() throws Exception {
        when(companyService.getCompanyById("99"))
                .thenThrow(new ResourceNotFoundException("Empresa no encontrada con ID: 99"));

        mockMvc.perform(get("/api/companies/99"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getAllCompanies_noFilter_returnsPage() throws Exception {
        CompanyResponse c1 = new CompanyResponse();
        c1.setId("company-1");
        c1.setName("Alpha Corp");

        CompanyResponse c2 = new CompanyResponse();
        c2.setId("company-2");
        c2.setName("Beta S.A.S.");

        Page<CompanyResponse> page = new PageImpl<>(new ArrayList<>(List.of(c1, c2)));
        when(companyService.getAllCompanies(any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/companies").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].name").value("Alpha Corp"));
    }

    @Test
    void getAllCompanies_activeFilter_callsActiveCompanies() throws Exception {
        Page<CompanyResponse> page = new PageImpl<>(new ArrayList<>());
        when(companyService.getActiveCompanies(any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/companies?status=active"))
                .andExpect(status().isOk());
    }

    // ─── Correo y teléfono: solo el dueño o un ADMIN ─────────────────────────

    @Test
    void getCompany_visitante_noVeCorreoNiTelefono() throws Exception {
        when(companyService.getCompanyById("1")).thenReturn(companyWithContact());

        mockMvc.perform(get("/api/companies/1").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("TechCorp"))
                .andExpect(jsonPath("$.email").doesNotExist())
                .andExpect(jsonPath("$.phone").doesNotExist());
    }

    @Test
    void getCompany_otraCuenta_noVeCorreoNiTelefono() throws Exception {
        loginAs("otra-cuenta-id", "EMPRESA");
        when(companyService.getCompanyById("1")).thenReturn(companyWithContact());

        mockMvc.perform(get("/api/companies/1"))
                .andExpect(jsonPath("$.email").doesNotExist())
                .andExpect(jsonPath("$.phone").doesNotExist());
    }

    @Test
    void getCompany_dueno_veCorreoYTelefono() throws Exception {
        loginAs("owner-user-id", "EMPRESA");
        when(companyService.getCompanyById("1")).thenReturn(companyWithContact());

        mockMvc.perform(get("/api/companies/1"))
                .andExpect(jsonPath("$.email").value("contacto@techcorp.co"))
                .andExpect(jsonPath("$.phone").value("6051234567"));
    }

    @Test
    void getCompany_admin_veCorreoYTelefono() throws Exception {
        loginAs("admin-id", "ADMIN");
        when(companyService.getCompanyById("1")).thenReturn(companyWithContact());

        mockMvc.perform(get("/api/companies/1"))
                .andExpect(jsonPath("$.email").value("contacto@techcorp.co"));
    }

    @Test
    void getAllCompanies_visitante_noVeCorreoNiTelefono() throws Exception {
        Page<CompanyResponse> page = new PageImpl<>(new ArrayList<>(List.of(companyWithContact())));
        when(companyService.getAllCompanies(any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/companies"))
                .andExpect(jsonPath("$.content[0].name").value("TechCorp"))
                .andExpect(jsonPath("$.content[0].email").doesNotExist())
                .andExpect(jsonPath("$.content[0].phone").doesNotExist());
    }

    @Test
    void searchCompanies_visitante_noVeCorreoNiTelefono() throws Exception {
        when(companyService.searchCompanies("Tech")).thenReturn(new ArrayList<>(List.of(companyWithContact())));

        mockMvc.perform(get("/api/companies/search?keyword=Tech"))
                .andExpect(jsonPath("$[0].email").doesNotExist())
                .andExpect(jsonPath("$[0].phone").doesNotExist());
    }

    @Test
    void getCompanyStatistics_otraEmpresa_responde403() throws Exception {
        loginAs("otra-cuenta-id", "EMPRESA");
        when(companyService.isOwner("1", "otra-cuenta-id")).thenReturn(false);

        mockMvc.perform(get("/api/companies/1/statistics"))
                .andExpect(status().isForbidden());

        verify(companyService, never()).getCompanyStatistics(anyString());
    }

    @Test
    void getCompanyStatistics_dueno_responde200() throws Exception {
        loginAs("owner-user-id", "EMPRESA");
        when(companyService.isOwner("1", "owner-user-id")).thenReturn(true);
        when(companyService.getCompanyStatistics("1")).thenReturn(Map.of("activeJobs", 2L));

        mockMvc.perform(get("/api/companies/1/statistics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeJobs").value(2));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private CompanyResponse companyWithContact() {
        CompanyResponse company = new CompanyResponse();
        company.setId("company-1");
        company.setName("TechCorp");
        company.setUserId("owner-user-id");
        company.setEmail("contacto@techcorp.co");
        company.setPhone("6051234567");
        return company;
    }

    private void loginAs(String userId, String role) {
        User u = new User();
        u.setId(userId);
        u.setEmail(userId + "@test.com");
        u.setRoles(List.of(role));
        UserDetailsImpl principal = UserDetailsImpl.build(u);
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        SecurityContextHolder.setContext(ctx);
    }

    @Test
    void searchCompanies_returnsMatchingList() throws Exception {
        CompanyResponse c = new CompanyResponse();
        c.setId("company-3");
        c.setName("SkillMatch SAS");

        when(companyService.searchCompanies("SkillMatch")).thenReturn(List.of(c));

        mockMvc.perform(get("/api/companies/search?keyword=SkillMatch"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("SkillMatch SAS"));
    }
}
