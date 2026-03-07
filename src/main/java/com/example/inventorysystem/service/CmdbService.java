package com.example.inventorysystem.service;

import com.example.inventorysystem.dto.CmdbResponse;
import com.example.inventorysystem.dto.PagedResponse;
import com.example.inventorysystem.exception.ResourceNotFoundException;
import com.example.inventorysystem.repository.CmdbRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CmdbService {

    private final CmdbRepository cmdbRepository;

    public PagedResponse<CmdbResponse> list(
            String search, String os, String environment, int page, int size) {

        var pageable = PageRequest.of(page, size, Sort.by("hostname").ascending());
        var results = cmdbRepository.findAllFiltered(
                nullIfBlank(search), nullIfBlank(os), nullIfBlank(environment), pageable);
        return new PagedResponse<>(results.map(CmdbResponse::new));
    }

    public CmdbResponse getByHostname(String hostname) {
        return cmdbRepository.findById(hostname)
                .map(CmdbResponse::new)
                .orElseThrow(() -> new ResourceNotFoundException("CMDB record not found: " + hostname));
    }

    private String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
