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

    // One row per active refresh token — may be several rows per logical session (see V55's own
    // comment on the grace-window race path); listSessions groups these by sessionId back into
    // "devices currently signed in".
    List<RefreshToken> findByUserIdAndRevokedFalseAndExpiresAtAfterOrderByCreatedAtDesc(UUID userId, Instant now);

    // A session can span several rows (see sessionId's own comment on RefreshToken), so revoking
    // one has to revoke every row sharing its lineage, not just whichever row the caller looked up.
    List<RefreshToken> findByUserIdAndSessionId(UUID userId, UUID sessionId);
    boolean existsByUserIdAndSessionId(UUID userId, UUID sessionId);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revoked = true WHERE r.userId = :userId")
    void revokeAllByUserId(UUID userId);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revoked = true WHERE r.userId = :userId AND r.revoked = false AND r.tokenHash <> :exceptTokenHash")
    void revokeAllByUserIdExcept(@Param("userId") UUID userId, @Param("exceptTokenHash") String exceptTokenHash);
}
