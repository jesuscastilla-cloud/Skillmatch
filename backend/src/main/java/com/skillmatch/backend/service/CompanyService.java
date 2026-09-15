package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.CompanyRequest;
import com.skillmatch.backend.dto.CompanyResponse;
import com.skillmatch.backend.exception.DuplicateResourceException;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.model.Company;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final JobService jobService;
    private final ApplicationService applicationService;
    private final MongoTemplate mongoTemplate;

    public CompanyResponse createCompany(CompanyRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new RuntimeException("El email de la empresa es obligatorio");
        }
        if (companyRepository.findByEmail(request.getEmail()).isPresent()) {
            log.warn("Intento de crear empresa con email duplicado: {}", request.getEmail());
            throw new DuplicateResourceException("Ya existe una empresa con este email");
        }

        String ownerId = userRepository.findByEmail(request.getEmail())
                .map(u -> u.getId())
                .orElseThrow(() -> new RuntimeException("Debe existir un usuario registrado con este email"));

        Company company = buildCompanyFromRequest(new Company(), request);
        company.setUserId(ownerId);
        company.setActive(true);
        company.setIsVerified(false);
        company.setCreatedAt(LocalDateTime.now());
        company.setUpdatedAt(LocalDateTime.now());

        Company saved = companyRepository.save(company);
        log.info("Empresa creada: '{}' (id={})", saved.getName(), saved.getId());
        return mapToResponse(saved);
    }

    public CompanyResponse updateCompany(String id, CompanyRequest request) {
        Company company = findCompanyOrThrow(id);

        String requestedEmail = request.getEmail();
        if (requestedEmail == null || requestedEmail.isBlank()) {
            throw new RuntimeException("El email de la empresa es obligatorio");
        }

        companyRepository.findByEmail(requestedEmail).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new DuplicateResourceException("Ya existe una empresa con este email");
            }
        });

        if (!company.getEmail().equals(requestedEmail)) {
            if (userRepository.existsByEmail(requestedEmail)) {
                throw new RuntimeException("El email ya está en uso por otro usuario");
            }
            if (company.getUserId() != null) {
                userRepository.findById(company.getUserId()).ifPresent(owner -> {
                    owner.setEmail(requestedEmail);
                    owner.setUpdatedAt(LocalDateTime.now());
                    userRepository.save(owner);
                });
            }
        }

        buildCompanyFromRequest(company, request);
        if (request.getIsVerified() != null) company.setIsVerified(request.getIsVerified());
        if (request.getActive() != null) company.setActive(request.getActive());
        company.setUpdatedAt(LocalDateTime.now());

        Company updated = companyRepository.save(company);
        log.info("Empresa actualizada: id={}", id);
        return mapToResponse(updated);
    }

    public CompanyResponse getCompanyById(String id) {
        return mapToResponse(findCompanyOrThrow(id));
    }

    public List<CompanyResponse> getAllCompanies() {
        return companyRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public Page<CompanyResponse> getAllCompanies(Pageable pageable) {
        return companyRepository.findAll(pageable).map(this::mapToResponse);
    }

    public List<CompanyResponse> getActiveCompanies() {
        return companyRepository.findByActiveTrue().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public Page<CompanyResponse> getActiveCompanies(Pageable pageable) {
        return companyRepository.findByActiveTrue(pageable).map(this::mapToResponse);
    }

    public List<CompanyResponse> searchCompanies(String keyword) {
        if (keyword == null || keyword.isBlank()) return getActiveCompanies();
        Criteria criteria = Criteria.where("active").is(true)
                .orOperator(
                        Criteria.where("name").regex(keyword, "i"),
                        Criteria.where("description").regex(keyword, "i"),
                        Criteria.where("industry").regex(keyword, "i")
                );
        return mongoTemplate.find(new Query(criteria), Company.class).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<CompanyResponse> getCompaniesByFilters(String industry, String location, String size) {
        List<Criteria> conditions = new ArrayList<>();
        conditions.add(Criteria.where("active").is(true));
        if (industry != null && !industry.isBlank()) conditions.add(Criteria.where("industry").is(industry));
        if (location != null && !location.isBlank()) conditions.add(Criteria.where("location").regex(location, "i"));
        if (size != null && !size.isBlank()) conditions.add(Criteria.where("size").is(size));
        Criteria criteria = new Criteria().andOperator(conditions.toArray(new Criteria[0]));
        return mongoTemplate.find(new Query(criteria), Company.class).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public void deleteCompany(String id) {
        Company company = findCompanyOrThrow(id);
        company.setActive(false);
        company.setUpdatedAt(LocalDateTime.now());
        companyRepository.save(company);
        log.info("Empresa desactivada: id={}", id);
    }

    public void verifyCompany(String id) {
        Company company = findCompanyOrThrow(id);
        company.setIsVerified(true);
        company.setUpdatedAt(LocalDateTime.now());
        companyRepository.save(company);
        log.info("Empresa verificada: id={}", id);
    }

    public CompanyResponse updateCompanyDescription(String id, String description) {
        Company company = findCompanyOrThrow(id);
        company.setDescription(description);
        company.setUpdatedAt(LocalDateTime.now());
        Company updated = companyRepository.save(company);
        log.info("Descripción actualizada para empresa id={}", id);
        return mapToResponse(updated);
    }

    public boolean isOwner(String companyId, String userId) {
        return companyRepository.findById(companyId)
                .map(c -> userId.equals(c.getUserId()))
                .orElse(false);
    }

    public Map<String, Object> getCompanyStatistics(String companyId) {
        Company company = findCompanyOrThrow(companyId);

        long totalJobs = jobService.countJobsByCompany(companyId);
        long activeJobs = jobService.countActiveJobsByCompany(companyId);
        long totalApplications = applicationService.countApplicationsByCompany(companyId);
        long pendingApplications = applicationService.countPendingApplicationsByCompany(companyId);

        LocalDateTime createdAt = company.getCreatedAt();
        long daysSinceCreation = createdAt != null ? ChronoUnit.DAYS.between(createdAt, LocalDateTime.now()) : 0;
        long profileViews = 100 + (totalJobs * 15L) + (totalApplications * 3L) + (daysSinceCreation * 5L);

        double responseRate = 0;
        if (totalApplications > 0) {
            responseRate = ((totalApplications - pendingApplications) * 100.0) / totalApplications;
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("profileViews", profileViews);
        stats.put("activeJobs", activeJobs);
        stats.put("totalJobs", totalJobs);
        stats.put("totalApplications", totalApplications);
        stats.put("pendingApplications", pendingApplications);
        stats.put("responseRate", Math.round(responseRate));
        return stats;
    }

    public void syncOwnerEmail(String userId, String newEmail) {
        companyRepository.findByUserId(userId).ifPresent(company -> {
            company.setEmail(newEmail);
            company.setUpdatedAt(LocalDateTime.now());
            companyRepository.save(company);
        });
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Company findCompanyOrThrow(String id) {
        return companyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada con ID: " + id));
    }

    private Company buildCompanyFromRequest(Company company, CompanyRequest request) {
        company.setName(request.getName());
        company.setDescription(request.getDescription());
        company.setIndustry(request.getIndustry());
        company.setSize(request.getSize());
        company.setLocation(request.getLocation());
        company.setLogo(request.getLogo());
        company.setWebsite(request.getWebsite());
        company.setEmail(request.getEmail());
        company.setPhone(request.getPhone());
        company.setFoundedYear(request.getFoundedYear());
        company.setBenefits(request.getBenefits());
        return company;
    }

    private CompanyResponse mapToResponse(Company company) {
        CompanyResponse response = new CompanyResponse();
        response.setId(company.getId());
        response.setName(company.getName());
        response.setDescription(company.getDescription());
        response.setIndustry(company.getIndustry());
        response.setSize(company.getSize());
        response.setLocation(company.getLocation());
        response.setLogo(company.getLogo());
        response.setWebsite(company.getWebsite());
        response.setEmail(company.getEmail());
        response.setPhone(company.getPhone());
        response.setUserId(company.getUserId());
        response.setFoundedYear(company.getFoundedYear());
        response.setBenefits(company.getBenefits());
        response.setIsVerified(company.getIsVerified());
        response.setActive(company.getActive());
        response.setCreatedAt(company.getCreatedAt());
        response.setUpdatedAt(company.getUpdatedAt());
        return response;
    }
}
