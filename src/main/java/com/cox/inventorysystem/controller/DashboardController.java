package com.cox.inventorysystem.controller;

import com.cox.inventorysystem.dto.InventoryResponse;
import com.cox.inventorysystem.dto.PagedResponse;
import com.cox.inventorysystem.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/assets")
    public PagedResponse<InventoryResponse> listAggregated(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return dashboardService.listAggregated(search, page, size);
    }
}
