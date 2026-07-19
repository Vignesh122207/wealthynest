package com.wealthynest.domain.vault.mapper;

import com.wealthynest.domain.vault.dto.response.VaultItemResponse;
import com.wealthynest.domain.vault.entity.VaultItem;
import com.wealthynest.domain.vault.entity.VaultItemType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class VaultItemMapperImplTest {

    private final VaultItemMapper mapper = new VaultItemMapperImpl();

    @Test
    @DisplayName("returns null for a null input")
    void nullInputReturnsNull() {
        assertThat(mapper.toResponse(null)).isNull();
    }

    @Test
    @DisplayName("maps every field, deriving itemType as its enum name and hasTotp=true when a TOTP secret is set")
    void mapsAllFieldsWithTotp() {
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        VaultItem item = VaultItem.builder()
                .itemType(VaultItemType.LOGIN).title("GitHub").username("alice").url("https://github.com")
                .category("Work").icon("KeyRound").favorite(true).lastRevealedAt(now)
                .totpCiphertext("encrypted-totp-secret")
                .build();
        ReflectionTestUtils.setField(item, "id", id);
        ReflectionTestUtils.setField(item, "createdAt", now);
        ReflectionTestUtils.setField(item, "updatedAt", now);

        VaultItemResponse response = mapper.toResponse(item);

        assertThat(response.getId()).isEqualTo(id);
        assertThat(response.getTitle()).isEqualTo("GitHub");
        assertThat(response.getUsername()).isEqualTo("alice");
        assertThat(response.getUrl()).isEqualTo("https://github.com");
        assertThat(response.getCategory()).isEqualTo("Work");
        assertThat(response.getIcon()).isEqualTo("KeyRound");
        assertThat(response.isFavorite()).isTrue();
        assertThat(response.getLastRevealedAt()).isEqualTo(now);
        assertThat(response.getCreatedAt()).isEqualTo(now);
        assertThat(response.getUpdatedAt()).isEqualTo(now);
        assertThat(response.getItemType()).isEqualTo("LOGIN");
        assertThat(response.isHasTotp()).isTrue();
    }

    @Test
    @DisplayName("hasTotp is false when no TOTP secret is stored")
    void hasTotpFalseWithoutSecret() {
        VaultItem item = VaultItem.builder()
                .itemType(VaultItemType.SECURE_NOTE).title("Recovery codes").favorite(false)
                .totpCiphertext(null)
                .build();

        VaultItemResponse response = mapper.toResponse(item);

        assertThat(response.isHasTotp()).isFalse();
        assertThat(response.getItemType()).isEqualTo("SECURE_NOTE");
    }
}
