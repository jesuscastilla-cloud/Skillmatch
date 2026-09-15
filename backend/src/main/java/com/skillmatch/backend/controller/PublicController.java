package com.skillmatch.backend.controller;

import com.skillmatch.backend.repository.ApplicationRepository;
import com.skillmatch.backend.repository.CompanyRepository;
import com.skillmatch.backend.repository.JobRepository;
import com.skillmatch.backend.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final JobRepository jobRepository;
    private final ApplicationRepository applicationRepository;

    public PublicController(UserRepository userRepository,
                            CompanyRepository companyRepository,
                            JobRepository jobRepository,
                            ApplicationRepository applicationRepository) {
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
        this.jobRepository = jobRepository;
        this.applicationRepository = applicationRepository;
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getStats() {
        return ResponseEntity.ok(Map.of(
            "users", userRepository.countByRolesContaining("USER"),
            "companies", companyRepository.countByActiveTrue(),
            "jobs", jobRepository.countByActiveTrue(),
            "applications", applicationRepository.count()
        ));
    }
}
