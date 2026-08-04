package com.wealthynest.domain.auth.repository;

import com.wealthynest.domain.auth.entity.EmailVerificationToken;
import com.wealthynest.domain.auth.entity.RefreshToken;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** RefreshToken and EmailVerificationToken both have a real user_id FK to users(id), so every
 * row here needs a genuinely persisted User rather than a disconnected random UUID. */
class AuthTokenRepositoriesTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private EmailVerificationTokenRepository emailVerificationTokenRepository;

    private UUID userId;

    @BeforeEach
    void seedUser() {
        User user = User.builder().fullName("Finn").email("finn-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();
        entityManager.flush();
    }

    private UUID persistOtherUser() {
        User other = User.builder().fullName("Gia").email("gia-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(other);
        return other.getId();
    }

    @Nested
    @DisplayName("RefreshTokenRepository")
    class RefreshTokenTests {

        @Test
        @DisplayName("findByTokenHash finds the exact stored hash")
        void findByTokenHashFindsExact() {
            RefreshToken t = RefreshToken.builder().userId(userId).sessionId(UUID.randomUUID()).tokenHash("hash-abc")
                    .expiresAt(Instant.now().plusSeconds(3600)).build();
            entityManager.persist(t);
            entityManager.flush();

            assertThat(refreshTokenRepository.findByTokenHash("hash-abc")).isPresent();
            assertThat(refreshTokenRepository.findByTokenHash("nonexistent")).isEmpty();
        }

        @Test
        @DisplayName("revokeAllByUserId revokes every token for that user, leaving other users' tokens untouched")
        void revokeAllOnlyTouchesThatUser() {
            RefreshToken mine = RefreshToken.builder().userId(userId).sessionId(UUID.randomUUID()).tokenHash("hash-mine")
                    .expiresAt(Instant.now().plusSeconds(3600)).revoked(false).build();
            entityManager.persist(mine);
            UUID otherUserId = persistOtherUser();
            RefreshToken theirs = RefreshToken.builder().userId(otherUserId).sessionId(UUID.randomUUID()).tokenHash("hash-theirs")
                    .expiresAt(Instant.now().plusSeconds(3600)).revoked(false).build();
            entityManager.persist(theirs);
            entityManager.flush();
            entityManager.clear();

            refreshTokenRepository.revokeAllByUserId(userId);
            entityManager.clear();

            assertThat(entityManager.find(RefreshToken.class, mine.getId()).isRevoked()).isTrue();
            assertThat(entityManager.find(RefreshToken.class, theirs.getId()).isRevoked()).isFalse();
        }
    }

    @Nested
    @DisplayName("EmailVerificationTokenRepository")
    class EmailVerificationTokenTests {

        @Test
        @DisplayName("findByTokenHash finds the exact stored hash")
        void findByTokenHashFindsExact() {
            EmailVerificationToken t = EmailVerificationToken.builder().userId(userId).tokenHash("evt-hash-abc")
                    .expiresAt(Instant.now().plusSeconds(3600)).build();
            entityManager.persist(t);
            entityManager.flush();

            assertThat(emailVerificationTokenRepository.findByTokenHash("evt-hash-abc")).isPresent();
        }

        @Test
        @DisplayName("deleteAllByUserId removes every token for that user, leaving other users' tokens untouched")
        void deleteAllOnlyTouchesThatUser() {
            EmailVerificationToken mine = EmailVerificationToken.builder().userId(userId).tokenHash("evt-mine")
                    .expiresAt(Instant.now().plusSeconds(3600)).build();
            entityManager.persist(mine);
            UUID otherUserId = persistOtherUser();
            EmailVerificationToken theirs = EmailVerificationToken.builder().userId(otherUserId).tokenHash("evt-theirs")
                    .expiresAt(Instant.now().plusSeconds(3600)).build();
            entityManager.persist(theirs);
            entityManager.flush();
            entityManager.clear();

            emailVerificationTokenRepository.deleteAllByUserId(userId);
            entityManager.clear();

            assertThat(entityManager.find(EmailVerificationToken.class, mine.getId())).isNull();
            assertThat(entityManager.find(EmailVerificationToken.class, theirs.getId())).isNotNull();
        }
    }
}
