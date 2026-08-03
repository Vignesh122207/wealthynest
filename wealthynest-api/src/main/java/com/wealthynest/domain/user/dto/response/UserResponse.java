package com.wealthynest.domain.user.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.time.Instant;
import java.util.UUID;

@Getter @Builder
public class UserResponse {
    private UUID    id;
    private String  fullName;
    private String  email;
    private String  pendingEmail;
    private String  role;
    private String  avatarUrl;
    private UUID    familyId;
    private boolean active;
    private Instant lastLoginAt;
    private Instant createdAt;
    private boolean pinEnabled;
    private boolean hasPasskeys;
}
