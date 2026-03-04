package com.example.inventorysystem.service;

import com.example.inventorysystem.dto.*;
import com.example.inventorysystem.exception.ResourceAlreadyExistsException;
import com.example.inventorysystem.exception.ResourceNotFoundException;
import com.example.inventorysystem.model.Inventory;
import com.example.inventorysystem.repository.InventoryRepository;
import com.example.inventorysystem.repository.NewRelicRepository;
import com.example.inventorysystem.repository.VsphereRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final VsphereRepository vsphereRepository;
    private final NewRelicRepository newRelicRepository;

    public PagedResponse<InventoryResponse> list(
            String search, String environment, String status,
            String assetType, int page, int size) {

        var pageable = PageRequest.of(page, size, Sort.by("hostname").ascending());
        var results = inventoryRepository.findAllFiltered(
                nullIfBlank(search), nullIfBlank(environment), nullIfBlank(status),
                nullIfBlank(assetType), pageable);
        return new PagedResponse<>(results.map(InventoryResponse::new));
    }

    public InventoryResponse getByHostname(String hostname) {
        return new InventoryResponse(findOrThrow(hostname));
    }

    public AssetDetailResponse getDetail(String hostname) {
        var inv = findOrThrow(hostname);
        var vsphere = vsphereRepository.findById(hostname).map(VsphereResponse::new).orElse(null);
        var newRelic = newRelicRepository.findById(hostname).map(NewRelicResponse::new).orElse(null);
        return new AssetDetailResponse(new InventoryResponse(inv), vsphere, newRelic);
    }

    @Transactional
    public InventoryResponse create(InventoryRequest req) {
        if (inventoryRepository.existsById(req.getHostname())) {
            throw new ResourceAlreadyExistsException("Inventory record already exists: " + req.getHostname());
        }
        Inventory inv = toEntity(new Inventory(), req);
        return new InventoryResponse(inventoryRepository.save(inv));
    }

    @Transactional
    public InventoryResponse update(String hostname, InventoryRequest req) {
        Inventory inv = findOrThrow(hostname);
        toEntity(inv, req);
        return new InventoryResponse(inventoryRepository.save(inv));
    }

    @Transactional
    public void delete(String hostname) {
        if (!inventoryRepository.existsById(hostname)) {
            throw new ResourceNotFoundException("Inventory record not found: " + hostname);
        }
        inventoryRepository.deleteById(hostname);
    }

    private Inventory findOrThrow(String hostname) {
        return inventoryRepository.findById(hostname)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory record not found: " + hostname));
    }

    private Inventory toEntity(Inventory inv, InventoryRequest req) {
        inv.setHostname(req.getHostname());
        inv.setIpAddress(req.getIpAddress());
        inv.setAssetType(req.getAssetType());
        inv.setEnvironment(req.getEnvironment());
        inv.setOwner(req.getOwner());
        inv.setLocation(req.getLocation());
        inv.setStatus(req.getStatus() != null ? req.getStatus() : "active");
        inv.setWarrantyExpiry(req.getWarrantyExpiry());
        inv.setLastPatchedAt(req.getLastPatchedAt());
        return inv;
    }

    private String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
