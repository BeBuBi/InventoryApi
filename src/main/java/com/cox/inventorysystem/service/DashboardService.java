package com.cox.inventorysystem.service;

import com.cox.inventorysystem.dto.InventoryResponse;
import com.cox.inventorysystem.dto.PagedResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final InventoryService inventoryService;

    public PagedResponse<InventoryResponse> listAggregated(String search, int page, int size) {
        return inventoryService.list(search, null, null, page, size);
    }
}
