package com.wealthynest.domain.vault.entity;

import com.wealthynest.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "vault_items")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class VaultItem extends BaseEntity {
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 20) private VaultItemType itemType;
    @Column(nullable = false, length = 150) private String title;
    @Column(length = 150) private String username;
    @Column(length = 500) private String url;
    @Column(length = 50) private String category;
    @Column(length = 30) private String icon;
    @Column(name = "secret_ciphertext", nullable = false, columnDefinition = "TEXT") private String secretCiphertext;
    @Column(name = "secret_iv", nullable = false, columnDefinition = "TEXT") private String secretIv;
    @Column(name = "key_version", nullable = false) @Builder.Default private int keyVersion = 1;
    @Column(nullable = false) @Builder.Default private boolean favorite = false;
    @Column(name = "last_revealed_at") private Instant lastRevealedAt;

    @Column(name = "secret_hash", length = 64) private String secretHash;
    @Column(name = "strength_level") private Integer strengthLevel;
    @Column(name = "breach_count") private Integer breachCount;

    @Column(name = "totp_ciphertext", columnDefinition = "TEXT") private String totpCiphertext;
    @Column(name = "totp_iv", columnDefinition = "TEXT") private String totpIv;
}
