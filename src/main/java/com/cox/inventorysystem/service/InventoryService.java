package com.cox.inventorysystem.service;

import com.cox.inventorysystem.dto.InventoryCountsResponse;
import com.cox.inventorysystem.dto.InventoryResponse;
import com.cox.inventorysystem.dto.IpDiscrepancyResponse;
import com.cox.inventorysystem.dto.PagedResponse;
import com.cox.inventorysystem.exception.ResourceNotFoundException;
import com.cox.inventorysystem.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

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

    public PagedResponse<InventoryResponse> listMissingFromCmdb(String search, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by("hostname").ascending());
        var results = inventoryRepository.findMissingFromCmdb(nullIfBlank(search), pageable);
        return new PagedResponse<>(results.map(InventoryResponse::new));
    }

    public long countMissingFromCmdb() {
        return inventoryRepository.countMissingFromCmdb();
    }

    public PagedResponse<IpDiscrepancyResponse> listIpDiscrepancies(String search, int page, int size) {
        // 1. Fetch hosts in CMDB that have at least one vSphere or NR IP
        var candidates = inventoryRepository.findCandidatesForIpDiscrepancy(nullIfBlank(search));

        // 2. For each host, iterate source IPs and keep only those not found in CMDB
        var discrepancies = candidates.stream()
                .filter(IpDiscrepancyResponse::isDiscrepancy)
                .sorted(Comparator.comparingLong(i -> {
                    var ips = IpDiscrepancyResponse.parseIpv4(i.getVsphereIpv4());
                    if (ips.isEmpty()) ips = IpDiscrepancyResponse.parseIpv4(i.getNrIpv4());
                    return ips.isEmpty() ? Long.MAX_VALUE : IpDiscrepancyResponse.ipToLong(ips.get(0));
                }))
                .map(IpDiscrepancyResponse::new)
                .toList();

        // 3. Paginate the filtered results
        long total = discrepancies.size();
        int from = page * size;
        int to = (int) Math.min((long) from + size, total);
        List<IpDiscrepancyResponse> pageContent =
                from >= total ? List.of() : discrepancies.subList(from, to);
        return new PagedResponse<>(pageContent, page, size, total);
    }

    private String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
