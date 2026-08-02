package com.wealthynest.domain.support.repository;

import com.wealthynest.domain.support.entity.SupportTicket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.UUID;

@Repository
public interface SupportTicketRepository extends JpaRepository<SupportTicket, UUID> {

    Page<SupportTicket> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<SupportTicket> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<SupportTicket> findByStatusOrderByCreatedAtDesc(SupportTicket.Status status, Pageable pageable);

    @Query("SELECT COUNT(t) FROM SupportTicket t WHERE t.status = 'OPEN'")
    long countOpen();

    /** Gate for permanent account erasure — an open/in-progress ticket may be an active dispute or
     * fraud investigation, which the deletion promise (see delete-account page) carves out as an
     * exception. support_tickets.user_id cascades unconditionally on user delete, so this has to be
     * checked and blocked at the application layer before deletion, not left to the DB. */
    boolean existsByUserIdAndStatusIn(UUID userId, java.util.Collection<SupportTicket.Status> statuses);
}
