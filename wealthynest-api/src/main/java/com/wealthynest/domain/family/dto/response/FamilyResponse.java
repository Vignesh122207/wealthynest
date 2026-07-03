package com.wealthynest.domain.family.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.time.Instant;
import java.util.UUID;

@Getter @Builder
public class FamilyResponse {
    private UUID    id;
    private String  name;
    private String  inviteCode;
    private Instant createdAt;
}
