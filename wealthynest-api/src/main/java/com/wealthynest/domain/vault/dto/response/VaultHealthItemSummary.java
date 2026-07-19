package com.wealthynest.domain.vault.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.util.UUID;

@Getter @Builder
public class VaultHealthItemSummary {
    private UUID id;
    private String title;
    private String itemType;
    private String icon;
}
