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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    long countByActiveTrue();
    long countByRole(UserRole role);
    java.util.List<User> findByFamilyId(UUID familyId);
    long countByFamilyId(UUID familyId);

    @Query("SELECT u FROM User u WHERE LOWER(u.fullName) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%'))")
    Page<User> search(@Param("q") String q, Pageable pageable);

    @Query(value = "SELECT COUNT(*) FROM users WHERE EXTRACT(YEAR FROM created_at) = :year AND EXTRACT(MONTH FROM created_at) = :month", nativeQuery = true)
    long countNewUsersInMonth(@Param("year") int year, @Param("month") int month);

    @Query(value = "SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS cnt FROM users WHERE created_at >= :startDate GROUP BY month ORDER BY month", nativeQuery = true)
    List<Object[]> countNewUsersByMonth(@Param("startDate") Instant startDate);
}
