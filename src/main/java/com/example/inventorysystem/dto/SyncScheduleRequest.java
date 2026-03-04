package com.example.inventorysystem.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SyncScheduleRequest {

    @NotBlank
    @Pattern(regexp = "vsphere|newrelic")
    private String service;

    @NotBlank
    private String cronExpr;

    private boolean enabled;

    private String description;
}
