package com.example.inventorysystem.dto;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public class AssetDetailResponse {

    private final InventoryResponse inventory;
    private final VsphereResponse vsphere;
    private final NewRelicResponse newRelic;
}
