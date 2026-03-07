package com.example.inventorysystem.service;

import com.example.inventorysystem.dto.PagedResponse;
import com.example.inventorysystem.dto.VsphereResponse;
import com.example.inventorysystem.exception.ResourceNotFoundException;
import com.example.inventorysystem.repository.VsphereRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class VsphereService {

    private final VsphereRepository vsphereRepository;

    public PagedResponse<VsphereResponse> list(
            String search, String powerState, int page, int size) {

        var pageable = PageRequest.of(page, size, Sort.by("hostname").ascending());
        var results = vsphereRepository.findAllFiltered(
                nullIfBlank(search), nullIfBlank(powerState), pageable);
        return new PagedResponse<>(results.map(VsphereResponse::new));
    }

    public VsphereResponse getByHostname(String hostname) {
        return vsphereRepository.findById(hostname)
                .map(VsphereResponse::new)
                .orElseThrow(() -> new ResourceNotFoundException("vSphere record not found: " + hostname));
    }

    private String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
