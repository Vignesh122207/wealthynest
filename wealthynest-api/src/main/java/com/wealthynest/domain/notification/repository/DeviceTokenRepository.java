package com.wealthynest.domain.notification.repository;

import com.wealthynest.domain.notification.entity.DeviceToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeviceTokenRepository extends JpaRepository<DeviceToken, UUID> {
    List<DeviceToken> findByUserId(UUID userId);
    Optional<DeviceToken> findByToken(String token);
    void deleteByToken(String token);
    /** Scoped by userId, not just the token — an unscoped deleteByToken let any authenticated user
     * unregister *any other* user's device token, since a token's only real secrecy is its own
     * high entropy (not something the request itself was ever checked against). See
     * NotificationServiceImpl#unregisterDeviceToken. */
    void deleteByUserIdAndToken(UUID userId, String token);
}
