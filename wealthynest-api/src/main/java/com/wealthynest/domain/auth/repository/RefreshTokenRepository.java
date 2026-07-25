package com.wealthynest.domain.auth.repository;

import com.wealthynest.domain.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);
    Optional<RefreshToken> findByIdAndUserId(UUID id, UUID userId);

    // One row per active session — see V44's own comment for why revoked=false + not-yet-expired
    // is exactly "devices currently signed in", with no separate session concept needed.
    List<RefreshToken> findByUserIdAndRevokedFalseAndExpiresAtAfterOrderByCreatedAtDesc(UUID userId, Instant now);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revoked = true WHERE r.userId = :userId")
    void revokeAllByUserId(UUID userId);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revoked = true WHERE r.userId = :userId AND r.revoked = false AND r.tokenHash <> :exceptTokenHash")
    void revokeAllByUserIdExcept(@Param("userId") UUID userId, @Param("exceptTokenHash") String exceptTokenHash);
}
