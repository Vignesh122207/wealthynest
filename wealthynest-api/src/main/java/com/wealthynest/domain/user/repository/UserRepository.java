package com.wealthynest.domain.user.repository;

import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.entity.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    long countByActiveTrue();
    long countByRole(UserRole role);
    List<User> findByFamilyId(UUID familyId);
    List<User> findByRole(UserRole role);
    long countByFamilyId(UUID familyId);

    @Query("SELECT u FROM User u WHERE LOWER(u.fullName) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%'))")
    Page<User> search(@Param("q") String q, Pageable pageable);

    default long countNewUsersInMonth(int year, int month) {
        LocalDate start = LocalDate.of(year, month, 1);
        return countByCreatedAtDateRange(
                start.atStartOfDay(ZoneOffset.UTC).toInstant(),
                start.plusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant());
    }

    @Query("SELECT COUNT(u) FROM User u WHERE u.createdAt >= :start AND u.createdAt < :end")
    long countByCreatedAtDateRange(@Param("start") Instant start, @Param("end") Instant end);

    @Query(value = "SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS cnt FROM users WHERE created_at >= :startDate GROUP BY month ORDER BY month", nativeQuery = true)
    List<Object[]> countNewUsersByMonth(@Param("startDate") Instant startDate);
}
