package com.example.inventorysystem.service;

import com.example.inventorysystem.dto.InventoryCountsResponse;
import com.example.inventorysystem.dto.InventoryResponse;
import com.example.inventorysystem.dto.PagedResponse;
import com.example.inventorysystem.exception.ResourceNotFoundException;
import com.example.inventorysystem.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryRepository inventoryRepository;

    public PagedResponse<InventoryResponse> list(
            String search, String operationalStatus, String sources, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by("hostname").ascending());
        var results = inventoryRepository.findAllFiltered(
                nullIfBlank(search), nullIfBlank(operationalStatus), nullIfBlank(sources), pageable);
        return new PagedResponse<>(results.map(InventoryResponse::new));
    }

    public InventoryCountsResponse getCounts() {
        return new InventoryCountsResponse(
                inventoryRepository.countTotal(),
                inventoryRepository.countVsphere(),
                inventoryRepository.countNewrelic(),
                inventoryRepository.countCmdb()
        );
    }

    public InventoryResponse getByHostname(String hostname) {
        return new InventoryResponse(inventoryRepository.findById(hostname)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory record not found: " + hostname)));
    }

    private String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
