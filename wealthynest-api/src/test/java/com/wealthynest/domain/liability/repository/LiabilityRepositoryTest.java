package com.wealthynest.domain.liability.repository;

import com.wealthynest.domain.family.entity.Family;
import com.wealthynest.domain.liability.entity.Liability;
import com.wealthynest.domain.liability.entity.LiabilityType;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class LiabilityRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private LiabilityRepository liabilityRepository;

    private UUID userId;
    private UUID familyId;

    @BeforeEach
    void seedUserAndFamily() {
        User user = User.builder().fullName("Liam").email("liam-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();

        Family family = Family.builder().name("The Liams").inviteCode("CODE" + UUID.randomUUID().toString().substring(0, 6)).build();
        entityManager.persist(family);
        familyId = family.getId();

        entityManager.flush();
    }

    private Liability persistLiability(UUID userId, UUID familyId, BigDecimal outstanding, boolean active) {
        Liability l = Liability.builder().userId(userId).familyId(familyId).name("Home Loan")
                .liabilityType(LiabilityType.HOME_LOAN).principalAmount(new BigDecimal("500000"))
                .outstandingAmount(outstanding).active(active).build();
        entityManager.persist(l);
        return l;
    }

    @Test
    @DisplayName("findByUserIdAndActiveTrueOrderByCreatedAtDesc excludes inactive rows and orders newest-first")
    void findByUserExcludesInactiveAndOrdersDesc() throws InterruptedException {
        Liability older = persistLiability(userId, null, new BigDecimal("400000"), true);
        entityManager.flush();
        Thread.sleep(5); // ensure a distinct created_at ordering between the two rows
        Liability newer = persistLiability(userId, null, new BigDecimal("300000"), true);
        persistLiability(userId, null, new BigDecimal("0"), false); // inactive — excluded
        entityManager.flush();

        List<Liability> result = liabilityRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getId()).isEqualTo(newer.getId());
        assertThat(result.get(1).getId()).isEqualTo(older.getId());
    }

    @Nested
    @DisplayName("aggregate sums")
    class AggregateSumTests {

        @Test
        @DisplayName("sumOutstandingByUser only counts active liabilities")
        void sumOutstandingOnlyActive() {
            persistLiability(userId, null, new BigDecimal("400000"), true);
            persistLiability(userId, null, new BigDecimal("999999"), false);
            entityManager.flush();

            assertThat(liabilityRepository.sumOutstandingByUser(userId)).isEqualByComparingTo("400000");
        }

        @Test
        @DisplayName("sumOutstandingByUserIn aggregates across multiple users in one query")
        void sumOutstandingByUserInAggregates() {
            User user2 = User.builder().fullName("Mona").email("mona-" + UUID.randomUUID() + "@x.com")
                    .passwordHash("hash").build();
            entityManager.persist(user2);
            entityManager.flush();

            persistLiability(userId, null, new BigDecimal("100000"), true);
            persistLiability(user2.getId(), null, new BigDecimal("200000"), true);
            entityManager.flush();

            BigDecimal sum = liabilityRepository.sumOutstandingByUserIn(List.of(userId, user2.getId()));

            assertThat(sum).isEqualByComparingTo("300000");
        }
    }

    @Nested
    @DisplayName("family-linkage modifying queries")
    class FamilyLinkageTests {

        @Test
        @DisplayName("migrateUserLiabilitiesToFamily only touches liabilities with no existing familyId")
        void migrateOnlyTouchesUnassigned() {
            Family otherFamily = Family.builder().name("Other").inviteCode("CODE" + UUID.randomUUID().toString().substring(0, 6)).build();
            entityManager.persist(otherFamily);

            Liability unassigned = persistLiability(userId, null, new BigDecimal("100000"), true);
            Liability alreadyAssigned = persistLiability(userId, otherFamily.getId(), new BigDecimal("200000"), true);
            entityManager.flush();
            entityManager.clear();

            liabilityRepository.migrateUserLiabilitiesToFamily(familyId, userId);
            entityManager.flush();
            entityManager.clear();

            assertThat(entityManager.find(Liability.class, unassigned.getId()).getFamilyId()).isEqualTo(familyId);
            assertThat(entityManager.find(Liability.class, alreadyAssigned.getId()).getFamilyId()).isEqualTo(otherFamily.getId());
        }

        @Test
        @DisplayName("clearFamilyId nulls familyId for every liability in the family")
        void clearFamilyIdNullsAll() {
            Liability l = persistLiability(userId, familyId, new BigDecimal("100000"), true);
            entityManager.flush();
            entityManager.clear();

            liabilityRepository.clearFamilyId(familyId);
            entityManager.clear();

            assertThat(entityManager.find(Liability.class, l.getId()).getFamilyId()).isNull();
        }

        @Test
        @DisplayName("clearFamilyIdForUser only detaches the specified user's liabilities")
        void clearFamilyIdForUserOnlyTouchesThatUser() {
            Liability mine = persistLiability(userId, familyId, new BigDecimal("100000"), true);

            User otherUser = User.builder().fullName("Nina").email("nina-" + UUID.randomUUID() + "@x.com")
                    .passwordHash("hash").build();
            entityManager.persist(otherUser);
            Liability theirs = persistLiability(otherUser.getId(), familyId, new BigDecimal("200000"), true);
            entityManager.flush();
            entityManager.clear();

            liabilityRepository.clearFamilyIdForUser(userId, familyId);
            entityManager.clear();

            assertThat(entityManager.find(Liability.class, mine.getId()).getFamilyId()).isNull();
            assertThat(entityManager.find(Liability.class, theirs.getId()).getFamilyId()).isEqualTo(familyId);
        }
    }
}
