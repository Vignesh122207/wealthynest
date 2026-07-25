package com.wealthynest.domain.vault.repository;

import com.wealthynest.domain.vault.entity.VaultItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VaultItemRepository extends JpaRepository<VaultItem, UUID> {
    List<VaultItem> findByUserIdOrderByFavoriteDescTitleAsc(UUID userId);
    Optional<VaultItem> findByIdAndUserId(UUID id, UUID userId);
    void deleteByUserId(UUID userId);
}
