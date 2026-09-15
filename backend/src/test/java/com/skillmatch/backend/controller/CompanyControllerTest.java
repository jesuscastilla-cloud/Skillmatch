package com.skillmatch.backend.controller;

import com.skillmatch.backend.dto.CompanyResponse;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.security.JwtTokenProvider;
import com.skillmatch.backend.service.CompanyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
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
