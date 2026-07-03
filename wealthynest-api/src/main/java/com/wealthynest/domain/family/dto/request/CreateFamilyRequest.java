package com.wealthynest.domain.family.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class CreateFamilyRequest {
    @NotBlank @Size(min = 2, max = 100)
    private String name;
}
