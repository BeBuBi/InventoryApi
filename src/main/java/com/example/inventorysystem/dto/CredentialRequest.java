package com.example.inventorysystem.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CredentialRequest {

    @NotBlank
    @Pattern(regexp = "vsphere|newrelic|cmdb")
    private String service;

    @NotBlank
    private String name;

    @NotBlank
    private String config;
}
