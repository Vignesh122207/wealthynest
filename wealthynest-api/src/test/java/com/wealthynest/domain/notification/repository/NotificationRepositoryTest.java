package com.wealthynest.domain.notification.repository;

import com.wealthynest.domain.notification.entity.Notification;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private NotificationRepository notificationRepository;

    private UUID userId;

    @BeforeEach
    void seedUser() {
        User user = User.builder().fullName("Will").email("will-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();
        entityManager.flush();
    }

    private Notification persistNotification(String type, String title, boolean read, Instant createdAt) {
        Notification n = Notification.builder().userId(userId).type(type).title(title)
                .message("msg").read(read).createdAt(createdAt).build();
        entityManager.persist(n);
        return n;
    }

    @Test
    @DisplayName("findByUserIdOrderByCreatedAtDesc paginates newest-first")
    void findByUserOrdersNewestFirst() {
        Notification older = persistNotification("BUDGET_BREACH", "Old", false, Instant.now().minusSeconds(3600));
        Notification newer = persistNotification("BUDGET_BREACH", "New", false, Instant.now());
        entityManager.flush();

        Page<Notification> page = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 10));

        assertThat(page.getContent()).hasSize(2);
        assertThat(page.getContent().get(0).getId()).isEqualTo(newer.getId());
    }

    @Test
    @DisplayName("countByUserIdAndReadFalse only counts unread notifications")
    void countUnreadExcludesRead() {
        persistNotification("BUDGET_BREACH", "Unread", false, Instant.now());
        persistNotification("BUDGET_BREACH", "Read", true, Instant.now());
        entityManager.flush();

        assertThat(notificationRepository.countByUserIdAndReadFalse(userId)).isEqualTo(1);
    }

    @Test
    @DisplayName("existsByUserIdAndTypeAndTitleAndCreatedAtAfter detects a same-day duplicate alert")
    void existsDetectsSameDayDuplicate() {
        Instant startOfToday = Instant.now().truncatedTo(ChronoUnit.DAYS);
        persistNotification("BUDGET_BREACH", "Groceries budget exceeded", false, Instant.now());
        entityManager.flush();

        boolean exists = notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(
                userId, "BUDGET_BREACH", "Groceries budget exceeded", startOfToday);
        boolean differentTitle = notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(
                userId, "BUDGET_BREACH", "Rent budget exceeded", startOfToday);

        assertThat(exists).isTrue();
        assertThat(differentTitle).isFalse();
    }

    @Test
    @DisplayName("markAllReadByUserId flips every unread row to read for that user only")
    void markAllReadOnlyTouchesThatUser() {
        Notification mine = persistNotification("BUDGET_BREACH", "Mine", false, Instant.now());

        User otherUser = User.builder().fullName("Xena").email("xena-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(otherUser);
        Notification theirs = Notification.builder().userId(otherUser.getId()).type("BUDGET_BREACH")
                .title("Theirs").message("msg").read(false).build();
        entityManager.persist(theirs);
        entityManager.flush();
        entityManager.clear();

        notificationRepository.markAllReadByUserId(userId);
        entityManager.clear();

        assertThat(entityManager.find(Notification.class, mine.getId()).isRead()).isTrue();
        assertThat(entityManager.find(Notification.class, theirs.getId()).isRead()).isFalse();
    }
}
