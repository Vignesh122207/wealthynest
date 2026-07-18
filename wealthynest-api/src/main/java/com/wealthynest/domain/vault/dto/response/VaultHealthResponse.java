package com.wealthynest.domain.vault.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.util.List;

@Getter @Builder
public class VaultHealthResponse {
    private int totalItems;
    private int reusedCount;
    private int weakCount;
    private int breachedCount;
    private List<VaultHealthItemSummary> reusedItems;
    private List<VaultHealthItemSummary> weakItems;
    private List<VaultHealthItemSummary> breachedItems;
}
