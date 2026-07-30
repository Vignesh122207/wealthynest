package com.wealthynest.domain.notification.repository;

import com.wealthynest.domain.notification.entity.DeviceToken;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class DeviceTokenRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private DeviceTokenRepository deviceTokenRepository;

    private UUID persistUser(String name) {
        User user = User.builder().fullName(name).email(name + "-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        return user.getId();
    }

    private DeviceToken persistToken(UUID userId, String token) {
        DeviceToken dt = DeviceToken.builder().userId(userId).token(token).build();
        entityManager.persist(dt);
        return dt;
    }

    @Test
    @DisplayName("deleteByUserIdAndToken only deletes when both the owner and the token match")
    void deleteByUserIdAndTokenIsOwnerScoped() {
        // Regression: NotificationServiceImpl#unregisterDeviceToken used to call deleteByToken
        // (token alone) — any authenticated user could unregister any other user's device token,
        // not just their own. See DeviceTokenRepository's own comment.
        UUID owner = persistUser("Owner");
        UUID attacker = persistUser("Attacker");
        DeviceToken victimToken = persistToken(owner, "victim-token");
        entityManager.flush();

        // A different user's id, same token value — must not delete the victim's row.
        deviceTokenRepository.deleteByUserIdAndToken(attacker, "victim-token");
        entityManager.flush();
        entityManager.clear();

        assertThat(entityManager.find(DeviceToken.class, victimToken.getId())).isNotNull();

        // The real owner, same token value — deletes it.
        deviceTokenRepository.deleteByUserIdAndToken(owner, "victim-token");
        entityManager.flush();
        entityManager.clear();

        assertThat(entityManager.find(DeviceToken.class, victimToken.getId())).isNull();
    }
}
