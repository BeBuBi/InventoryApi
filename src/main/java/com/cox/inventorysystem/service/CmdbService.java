package com.cox.inventorysystem.service;

import com.cox.inventorysystem.dto.CmdbResponse;
import com.cox.inventorysystem.dto.PagedResponse;
import com.cox.inventorysystem.exception.ResourceNotFoundException;
import com.cox.inventorysystem.repository.CmdbRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CmdbService {

    private final CmdbRepository cmdbRepository;

    public PagedResponse<CmdbResponse> list(
            String search,
            List<String> opStatuses,
            List<String> osVersions,
            int page,
            int size) {

        var pageable = PageRequest.of(page, size, Sort.by("hostname").ascending());
        var results = cmdbRepository.findAllFiltered(
                nullIfBlank(search),
                nullIfEmpty(opStatuses),
                nullIfEmpty(osVersions),
                pageable);
        return new PagedResponse<>(results.map(CmdbResponse::new));
    }

    public CmdbResponse getByHostname(String hostname) {
        return cmdbRepository.findById(hostname)
                .map(CmdbResponse::new)
                .orElseThrow(() -> new ResourceNotFoundException("CMDB record not found: " + hostname));
    }

    public List<String> listOperationalStatuses() {
        return cmdbRepository.findDistinctOperationalStatuses();
    }

    public List<String> listOsVersions() {
        return cmdbRepository.findDistinctOsVersions();
    }

    private String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private List<String> nullIfEmpty(List<String> list) {
        return (list == null || list.isEmpty()) ? null : list;
    }
}
