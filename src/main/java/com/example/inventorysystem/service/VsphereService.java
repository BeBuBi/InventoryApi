package com.example.inventorysystem.service;

import com.example.inventorysystem.dto.PagedResponse;
import com.example.inventorysystem.dto.VsphereResponse;
import com.example.inventorysystem.exception.ResourceNotFoundException;
import com.example.inventorysystem.repository.VsphereRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class VsphereService {

    private final VsphereRepository vsphereRepository;

    public PagedResponse<VsphereResponse> list(
            String search,
            List<String> powerStates,
            List<String> sourceUrls,
            List<String> guestOsTypes,
            int page,
            int size) {

        var pageable = PageRequest.of(page, size, Sort.by("hostname").ascending());
        var results = vsphereRepository.findAllFiltered(
                nullIfBlank(search),
                emptyIfNull(powerStates),
                emptyIfNull(sourceUrls),
                emptyIfNull(guestOsTypes),
                pageable);
        return new PagedResponse<>(results.map(VsphereResponse::new));
    }

    public List<String> listSourceUrls() {
        return vsphereRepository.findDistinctSourceUrls();
    }

    public List<String> listGuestOsTypes() {
        var types = vsphereRepository.findDistinctGuestOs();
        if (types.isEmpty()) {
            log.warn("listGuestOsTypes: no non-null guest_os values found. "
                    + "The guest_os column may be NULL for all rows — run a vSphere sync to populate it.");
        }
        return types;
    }

    public VsphereResponse getByHostname(String hostname) {
        return vsphereRepository.findById(hostname)
                .map(VsphereResponse::new)
                .orElseThrow(() -> new ResourceNotFoundException("vSphere record not found: " + hostname));
    }

    private String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private List<String> emptyIfNull(List<String> list) {
        return list == null ? List.of() : list;
    }
}
