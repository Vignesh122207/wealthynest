package com.wealthynest.domain.networth.repository;

import com.wealthynest.domain.networth.entity.NetWorthSnapshot;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class NetWorthSnapshotRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private NetWorthSnapshotRepository netWorthSnapshotRepository;

    private UUID userId;

    @BeforeEach
    void seedUser() {
        User user = User.builder().fullName("Amir").email("amir-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();
        entityManager.flush();
    }

    private NetWorthSnapshot persistSnapshot(int year, int month, BigDecimal netWorth) {
        NetWorthSnapshot s = NetWorthSnapshot.builder().userId(userId).year(year).month(month).netWorth(netWorth).build();
        entityManager.persist(s);
        return s;
    }

    @Test
    @DisplayName("findByUserIdAndYearAndMonth finds the exact month's snapshot")
    void findByUserYearMonthFindsExact() {
        persistSnapshot(2026, 6, new BigDecimal("50000"));
        entityManager.flush();

        Optional<NetWorthSnapshot> found = netWorthSnapshotRepository.findByUserIdAndYearAndMonth(userId, 2026, 6);
        Optional<NetWorthSnapshot> notFound = netWorthSnapshotRepository.findByUserIdAndYearAndMonth(userId, 2026, 7);

        assertThat(found).isPresent();
        assertThat(notFound).isEmpty();
    }

    @Test
    @DisplayName("findLast13ByUserId caps at 13 rows, newest-first")
    void findLast13CapsAndOrdersDescending() {
        // 15 consecutive months starting Jan 2025
        for (int i = 0; i < 15; i++) {
            int year = 2025 + (i / 12);
            int month = (i % 12) + 1;
            persistSnapshot(year, month, new BigDecimal(1000 * (i + 1)));
        }
        entityManager.flush();

        List<NetWorthSnapshot> result = netWorthSnapshotRepository.findLast13ByUserId(userId);

        assertThat(result).hasSize(13);
        // newest of the 15 is index 14 -> year=2026, month=3 (0-based i=14 -> year 2025+1=2026, month=3)
        assertThat(result.get(0).getYear()).isEqualTo(2026);
        assertThat(result.get(0).getMonth()).isEqualTo(3);
    }
}
