package com.wealthynest.domain.family.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.util.UUID;

@Getter @Builder
public class FamilyMemberResponse {
    private UUID   id;
    private String fullName;
    private String email;
    private String role;
}
