package com.example.inventorysystem.controller;

import com.example.inventorysystem.dto.InventoryCountsResponse;
import com.example.inventorysystem.dto.InventoryResponse;
import com.example.inventorysystem.dto.PagedResponse;
import com.example.inventorysystem.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping
    public PagedResponse<InventoryResponse> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String operationalStatus,
            @RequestParam(required = false) String sources,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return inventoryService.list(search, operationalStatus, sources, page, size);
    }

    @GetMapping("/counts")
    public InventoryCountsResponse getCounts() {
        return inventoryService.getCounts();
    }

    @GetMapping("/{hostname}")
    public InventoryResponse getByHostname(@PathVariable String hostname) {
        return inventoryService.getByHostname(hostname);
    }
}
