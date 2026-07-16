package com.wealthynest.domain.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

/**
 * A registered passkey (WebAuthn credential). publicKeyCose/aaguid are stored as the raw CBOR
 * bytes webauthn4j itself produces/consumes, so a login ceremony can reconstruct the exact
 * CredentialRecord it needs to verify a signature — see AuthServiceImpl for the ceremony code.
 */
@Entity
@Table(name = "webauthn_credentials")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WebAuthnCredential {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "credential_id", nullable = false, unique = true)
    private byte[] credentialId;

    @Column(name = "aaguid", nullable = false)
    private byte[] aaguid;

    @Column(name = "public_key_cose", nullable = false)
    private byte[] publicKeyCose;

    @Column(name = "sign_count", nullable = false)
    @Builder.Default
    private long signCount = 0;

    @Column(name = "transports", length = 100)
    private String transports;

    @Column(name = "nickname", length = 100)
    private String nickname;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "last_used_at")
    private Instant lastUsedAt;
}
