package com.wealthynest.domain.auth.repository;

import com.wealthynest.domain.auth.entity.WebAuthnCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WebAuthnCredentialRepository extends JpaRepository<WebAuthnCredential, UUID> {
    List<WebAuthnCredential> findByUserId(UUID userId);
    Optional<WebAuthnCredential> findByCredentialId(byte[] credentialId);
    Optional<WebAuthnCredential> findByIdAndUserId(UUID id, UUID userId);
}
