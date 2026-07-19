package com.wealthynest.domain.vault.service;

import com.wealthynest.domain.vault.dto.request.RevealVaultItemRequest;
import com.wealthynest.domain.vault.dto.request.VaultItemRequest;
import com.wealthynest.domain.vault.dto.response.VaultHealthResponse;
import com.wealthynest.domain.vault.dto.response.VaultItemResponse;
import com.wealthynest.domain.vault.dto.response.VaultItemSecretResponse;
import java.util.List;
import java.util.UUID;

public interface VaultService {
    VaultItemResponse createItem(UUID userId, VaultItemRequest request);
    VaultItemResponse updateItem(UUID itemId, UUID userId, VaultItemRequest request);
    void deleteItem(UUID itemId, UUID userId);
    List<VaultItemResponse> getItems(UUID userId);
    VaultItemResponse getItem(UUID itemId, UUID userId);
    VaultItemResponse toggleFavorite(UUID itemId, UUID userId);
    VaultItemSecretResponse revealSecret(UUID itemId, UUID userId, RevealVaultItemRequest request,
                                          String ipAddress, String userAgent);
    VaultHealthResponse getHealthSummary(UUID userId);
    /** Step-up-gated (same pattern as revealSecret, its own lockout scope): decrypts every item's
     * secret and returns it as CSV text. */
    String exportCsv(UUID userId, RevealVaultItemRequest request, String ipAddress, String userAgent);
}
