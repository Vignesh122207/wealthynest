package com.wealthynest.common.audit;

import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AuditLogRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private AuditLogRepository auditLogRepository;

    private UUID userId;

    @BeforeEach
    void seedUser() {
        User user = User.builder().fullName("Hank").email("hank-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();
        entityManager.flush();
    }

    private AuditLog persistLog(UUID userId, String action) {
        AuditLog log = AuditLog.builder().userId(userId).action(action).build();
        entityManager.persist(log);
        return log;
    }

    @Test
    @DisplayName("findAllByOrderByCreatedAtDesc returns rows newest-first (delta-checked against shared-DB pollution)")
    void findAllOrdersNewestFirst() {
        long before = auditLogRepository.count();
        AuditLog older = persistLog(userId, "LOGIN_SUCCESS");
        entityManager.flush();
        AuditLog newer = persistLog(userId, "LOGOUT");
        entityManager.flush();

        Page<AuditLog> page = auditLogRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, (int) (before + 10)));

        assertThat(page.getTotalElements()).isEqualTo(before + 2);
        assertThat(page.getContent().get(0).getId()).isEqualTo(newer.getId());
    }

    @Test
    @DisplayName("findWithFilters treats a null userId/action as 'match anything' rather than excluding all rows")
    void findWithFiltersNullMeansMatchAll() {
        persistLog(userId, "LOGIN_SUCCESS");
        entityManager.flush();

        Page<AuditLog> result = auditLogRepository.findWithFilters(null, null, PageRequest.of(0, 10));

        assertThat(result.getContent()).isNotEmpty();
    }

    @Test
    @DisplayName("findWithFilters scopes by userId when provided")
    void findWithFiltersScopesToUserId() {
        AuditLog mine = persistLog(userId, "LOGIN_SUCCESS");

        User otherUser = User.builder().fullName("Ivy").email("ivy-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(otherUser);
        persistLog(otherUser.getId(), "LOGIN_SUCCESS");
        entityManager.flush();

        Page<AuditLog> result = auditLogRepository.findWithFilters(userId, null, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(AuditLog::getId).containsExactly(mine.getId());
    }

    @Test
    @DisplayName("findWithFilters matches action via LIKE substring, not exact equality")
    void findWithFiltersMatchesActionSubstring() {
        AuditLog log = persistLog(userId, "ACCOUNT_LOCKED");
        entityManager.flush();

        Page<AuditLog> result = auditLogRepository.findWithFilters(null, "LOCKED", PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(AuditLog::getId).contains(log.getId());
    }
}
