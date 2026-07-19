package com.wealthynest.domain.user.repository;

import com.wealthynest.domain.family.entity.Family;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.entity.UserRole;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class UserRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private UserRepository userRepository;

    private UUID familyId;

    @BeforeEach
    void seedFamily() {
        Family family = Family.builder().name("The Testers").inviteCode("CODE" + UUID.randomUUID().toString().substring(0, 6)).build();
        entityManager.persist(family);
        familyId = family.getId();
        entityManager.flush();
    }

    private User persistUser(String fullName, String email, UserRole role, UUID familyId, boolean active) {
        User u = User.builder().fullName(fullName).email(email).passwordHash("hash")
                .role(role).familyId(familyId).active(active).build();
        entityManager.persist(u);
        return u;
    }

    @Test
    @DisplayName("findByEmail and existsByEmail reflect real rows")
    void findAndExistsByEmail() {
        persistUser("Alice", "alice@example.com", UserRole.MEMBER, null, true);
        entityManager.flush();

        assertThat(userRepository.findByEmail("alice@example.com")).isPresent();
        assertThat(userRepository.existsByEmail("alice@example.com")).isTrue();
        assertThat(userRepository.existsByEmail("nobody@example.com")).isFalse();
    }

    @Nested
    @DisplayName("counting queries")
    class CountingTests {

        @Test
        @DisplayName("countByActiveTrue excludes inactive users")
        void countByActiveTrueExcludesInactive() {
            // countByActiveTrue has no scoping filter at all, so against the shared Testcontainers
            // Postgres other (non-rolled-back) @SpringBootTest classes may have already committed
            // real rows — assert the delta this test itself causes, not an absolute count.
            long before = userRepository.countByActiveTrue();
            persistUser("Active", "active@example.com", UserRole.MEMBER, null, true);
            persistUser("Inactive", "inactive@example.com", UserRole.MEMBER, null, false);
            entityManager.flush();

            assertThat(userRepository.countByActiveTrue() - before).isEqualTo(1);
        }

        @Test
        @DisplayName("countByRole scopes strictly by role")
        void countByRoleScopesStrictly() {
            long adminBefore = userRepository.countByRole(UserRole.ADMIN);
            long memberBefore = userRepository.countByRole(UserRole.MEMBER);
            persistUser("Admin", "admin@example.com", UserRole.ADMIN, null, true);
            persistUser("Member", "member@example.com", UserRole.MEMBER, null, true);
            entityManager.flush();

            assertThat(userRepository.countByRole(UserRole.ADMIN) - adminBefore).isEqualTo(1);
            assertThat(userRepository.countByRole(UserRole.MEMBER) - memberBefore).isEqualTo(1);
        }

        @Test
        @DisplayName("countByFamilyId and findByFamilyId scope to the given family")
        void countAndFindByFamilyIdScoped() {
            persistUser("Member1", "m1@example.com", UserRole.MEMBER, familyId, true);
            persistUser("Member2", "m2@example.com", UserRole.MEMBER, familyId, true);
            persistUser("Outsider", "out@example.com", UserRole.MEMBER, null, true);
            entityManager.flush();

            assertThat(userRepository.countByFamilyId(familyId)).isEqualTo(2);
            assertThat(userRepository.findByFamilyId(familyId)).hasSize(2);
        }
    }

    @Test
    @DisplayName("search matches case-insensitively by name OR email substring")
    void searchMatchesNameOrEmailCaseInsensitively() {
        persistUser("Alice Wonderland", "alice@example.com", UserRole.MEMBER, null, true);
        persistUser("Bob Builder", "bob@special-domain.com", UserRole.MEMBER, null, true);
        entityManager.flush();

        Page<User> byName = userRepository.search("WONDER", PageRequest.of(0, 10));
        Page<User> byEmail = userRepository.search("special-domain", PageRequest.of(0, 10));

        assertThat(byName.getContent()).extracting(User::getFullName).containsExactly("Alice Wonderland");
        assertThat(byEmail.getContent()).extracting(User::getFullName).containsExactly("Bob Builder");
    }

    @Nested
    @DisplayName("registration-date range queries")
    class RegistrationDateTests {

        @Test
        @DisplayName("countNewUsersInMonth only counts users created within that calendar month")
        void countNewUsersInMonthScopesToCalendarMonth() {
            User inMonth = persistUser("InMonth", "in@example.com", UserRole.MEMBER, null, true);
            entityManager.flush();
            // force createdAt into June 2026 directly, since @CreatedDate always stamps "now"
            entityManager.getEntityManager().createNativeQuery(
                    "UPDATE users SET created_at = ? WHERE id = ?")
                    .setParameter(1, LocalDate.of(2026, 6, 15).atStartOfDay(ZoneOffset.UTC).toInstant())
                    .setParameter(2, inMonth.getId())
                    .executeUpdate();

            User outOfMonth = persistUser("OutOfMonth", "out2@example.com", UserRole.MEMBER, null, true);
            entityManager.flush();
            entityManager.getEntityManager().createNativeQuery(
                    "UPDATE users SET created_at = ? WHERE id = ?")
                    .setParameter(1, LocalDate.of(2026, 7, 1).atStartOfDay(ZoneOffset.UTC).toInstant())
                    .setParameter(2, outOfMonth.getId())
                    .executeUpdate();
            entityManager.clear();

            assertThat(userRepository.countNewUsersInMonth(2026, 6)).isEqualTo(1);
        }

        @Test
        @DisplayName("countNewUsersByMonth's native TO_CHAR grouping returns one row per registration month")
        void countNewUsersByMonthGroupsNatively() {
            // A window "just before now" (not an arbitrary hour-wide lookback) excludes rows
            // already committed by other, non-rolled-back @SpringBootTest classes sharing this
            // same reused Testcontainers Postgres (e.g. AuthFlowIntegrationTest) — a wider window
            // picks up their real user rows too and inflates this count unpredictably depending
            // on full-suite run order.
            Instant testStart = Instant.now().minusSeconds(2);
            persistUser("User1", "u1@example.com", UserRole.MEMBER, null, true);
            persistUser("User2", "u2@example.com", UserRole.MEMBER, null, true);
            entityManager.flush();

            List<Object[]> rows = userRepository.countNewUsersByMonth(testStart);

            assertThat(rows).isNotEmpty();
            long total = rows.stream().mapToLong(r -> ((Number) r[1]).longValue()).sum();
            assertThat(total).isEqualTo(2);
        }
    }
}
