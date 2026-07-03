package com.wealthynest.domain.family.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class JoinFamilyRequest {
    @NotBlank
    private String inviteCode;
}
