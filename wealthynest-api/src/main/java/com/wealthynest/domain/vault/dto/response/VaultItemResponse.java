package com.wealthynest.domain.vault.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.time.Instant;
import java.util.UUID;

/** Never carries the secret — list/detail views only. See {@link VaultItemSecretResponse} for reveal. */
@Getter @Builder
public class VaultItemResponse {
    private UUID id;
    private String itemType;
    private String title;
    private String username;
    private String url;
    private String category;
    private String icon;
    private boolean favorite;
    private boolean hasTotp;
    private Instant lastRevealedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
