package com.example.inventorysystem.service;

import com.example.inventorysystem.dto.NewRelicResponse;
import com.example.inventorysystem.dto.PagedResponse;
import com.example.inventorysystem.exception.ResourceNotFoundException;
import com.example.inventorysystem.repository.NewRelicRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NewRelicService {

    private final NewRelicRepository newRelicRepository;

    public PagedResponse<NewRelicResponse> list(
            String search, String service, String environment, int page, int size) {

        var pageable = PageRequest.of(page, size, Sort.by("hostname").ascending());
        var results = newRelicRepository.findAllFiltered(
                nullIfBlank(search), nullIfBlank(service), nullIfBlank(environment), pageable);
        return new PagedResponse<>(results.map(NewRelicResponse::new));
    }

    public NewRelicResponse getByHostname(String hostname) {
        return newRelicRepository.findById(hostname)
                .map(NewRelicResponse::new)
                .orElseThrow(() -> new ResourceNotFoundException("New Relic record not found: " + hostname));
    }

    private String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
