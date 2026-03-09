package com.cox.inventorysystem.dto;

public record InventoryCountsResponse(long total, long vsphere, long newrelic, long cmdb) {}
