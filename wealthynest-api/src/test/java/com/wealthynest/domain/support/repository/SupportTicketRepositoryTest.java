package com.wealthynest.domain.support.repository;

import com.wealthynest.domain.support.entity.SupportTicket;
import com.wealthynest.domain.support.entity.TicketReply;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SupportTicket uses real Postgres native enum types (ticket_category/status/priority via
 * @JdbcTypeCode(NAMED_ENUM)) — exactly the case AbstractRepositoryTest exists for, since H2
 * can't parse them.
 */
class SupportTicketRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private SupportTicketRepository supportTicketRepository;
    @Autowired private TicketReplyRepository ticketReplyRepository;

    private UUID userId;

    @BeforeEach
    void seedUser() {
        User user = User.builder().fullName("Yara").email("yara-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();
        entityManager.flush();
    }

    private SupportTicket persistTicket(SupportTicket.Status status) {
        SupportTicket t = SupportTicket.builder().userId(userId).subject("Help needed")
                .category(SupportTicket.Category.BUG_REPORT).description("Something is broken.")
                .status(status).build();
        entityManager.persist(t);
        return t;
    }

    @Test
    @DisplayName("findByUserIdOrderByCreatedAtDesc scopes to the owning user")
    void findByUserScopesToOwner() {
        SupportTicket mine = persistTicket(SupportTicket.Status.OPEN);

        User otherUser = User.builder().fullName("Zack").email("zack-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(otherUser);
        SupportTicket theirs = SupportTicket.builder().userId(otherUser.getId()).subject("Other")
                .category(SupportTicket.Category.GENERAL_QUESTION).description("Other issue.").build();
        entityManager.persist(theirs);
        entityManager.flush();

        Page<SupportTicket> page = supportTicketRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(SupportTicket::getId).containsExactly(mine.getId());
    }

    @Test
    @DisplayName("findByStatusOrderByCreatedAtDesc filters by the native enum status column correctly")
    void findByStatusFiltersNativeEnum() {
        persistTicket(SupportTicket.Status.OPEN);
        persistTicket(SupportTicket.Status.CLOSED);
        entityManager.flush();

        Page<SupportTicket> open = supportTicketRepository.findByStatusOrderByCreatedAtDesc(
                SupportTicket.Status.OPEN, PageRequest.of(0, 10));

        assertThat(open.getContent()).allMatch(t -> t.getStatus() == SupportTicket.Status.OPEN);
    }

    @Test
    @DisplayName("countOpen only counts OPEN-status tickets, verified via a before/after delta against the shared DB")
    void countOpenCountsOnlyOpenStatus() {
        long before = supportTicketRepository.countOpen();
        persistTicket(SupportTicket.Status.OPEN);
        persistTicket(SupportTicket.Status.RESOLVED);
        entityManager.flush();

        assertThat(supportTicketRepository.countOpen() - before).isEqualTo(1);
    }

    @Nested
    @DisplayName("TicketReplyRepository")
    class TicketReplyTests {

        @Test
        @DisplayName("findByTicketIdOrderByCreatedAtAsc returns replies oldest-first, scoped to the ticket")
        void findByTicketOrdersOldestFirst() throws InterruptedException {
            SupportTicket ticket = persistTicket(SupportTicket.Status.OPEN);
            entityManager.flush();

            TicketReply first = TicketReply.builder().ticketId(ticket.getId()).userId(userId)
                    .message("First reply").build();
            entityManager.persist(first);
            entityManager.flush();
            Thread.sleep(5);
            TicketReply second = TicketReply.builder().ticketId(ticket.getId()).userId(userId)
                    .message("Second reply").adminReply(true).build();
            entityManager.persist(second);
            entityManager.flush();

            List<TicketReply> replies = ticketReplyRepository.findByTicketIdOrderByCreatedAtAsc(ticket.getId());

            assertThat(replies).extracting(TicketReply::getId).containsExactly(first.getId(), second.getId());
        }
    }
}
