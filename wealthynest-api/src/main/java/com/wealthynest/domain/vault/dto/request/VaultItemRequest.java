package com.wealthynest.domain.vault.dto.request;

import com.wealthynest.domain.vault.entity.VaultItemType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class VaultItemRequest {
    @NotNull private VaultItemType itemType;
    @NotBlank @Size(max = 150) private String title;
    @Size(max = 150) private String username;
    @Size(max = 500) private String url;
    @Size(max = 50)  private String category;
    @Size(max = 30)  private String icon;

    /** Plaintext password (LOGIN) or note body (SECURE_NOTE). Required on create;
     * on update, leave blank to keep the existing secret unchanged. */
    @Size(max = 2000) private String secret;

    /** Optional base32 TOTP secret (LOGIN items only). {@code null} = don't touch the existing
     * TOTP secret; {@code ""} = remove it; non-blank = set/replace it. */
    @Size(max = 200) private String totpSecret;
}
