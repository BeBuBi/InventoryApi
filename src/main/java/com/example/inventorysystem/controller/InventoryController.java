package com.example.inventorysystem.controller;

import com.example.inventorysystem.dto.*;
import com.example.inventorysystem.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping
    public PagedResponse<InventoryResponse> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String environment,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String assetType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return inventoryService.list(search, environment, status, assetType, page, size);
    }

    @GetMapping("/{hostname}")
    public InventoryResponse getByHostname(@PathVariable String hostname) {
        return inventoryService.getByHostname(hostname);
    }

    @GetMapping("/{hostname}/detail")
    public AssetDetailResponse getDetail(@PathVariable String hostname) {
        return inventoryService.getDetail(hostname);
    }

    @PostMapping
    public ResponseEntity<InventoryResponse> create(@Valid @RequestBody InventoryRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryService.create(req));
    }

    @PutMapping("/{hostname}")
    public InventoryResponse update(@PathVariable String hostname,
                                    @Valid @RequestBody InventoryRequest req) {
        return inventoryService.update(hostname, req);
    }

    @DeleteMapping("/{hostname}")
    public ResponseEntity<Void> delete(@PathVariable String hostname) {
        inventoryService.delete(hostname);
        return ResponseEntity.noContent().build();
    }
}
