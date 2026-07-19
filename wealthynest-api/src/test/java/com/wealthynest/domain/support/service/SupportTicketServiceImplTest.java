package com.wealthynest.domain.support.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.notification.repository.NotificationRepository;
import com.wealthynest.domain.support.dto.CreateTicketRequest;
import com.wealthynest.domain.support.dto.ReplyRequest;
import com.wealthynest.domain.support.dto.TicketResponse;
import com.wealthynest.domain.support.entity.SupportTicket;
import com.wealthynest.domain.support.repository.SupportTicketRepository;
import com.wealthynest.domain.support.repository.TicketReplyRepository;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.entity.UserRole;
import com.wealthynest.domain.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SupportTicketServiceImplTest {

    @Mock private SupportTicketRepository ticketRepository;
    @Mock private TicketReplyRepository   replyRepository;
    @Mock private UserRepository          userRepository;
    @Mock private NotificationRepository  notificationRepository;

    @InjectMocks
    private SupportTicketServiceImpl service;

    private final UUID userId   = UUID.randomUUID();
    private final UUID ticketId = UUID.randomUUID();

    @BeforeEach
    void stubEmptyReplies() {
        lenient().when(replyRepository.findByTicketIdOrderByCreatedAtAsc(any())).thenReturn(List.of());
        lenient().when(userRepository.findAllById(any())).thenReturn(List.of());
    }

    private SupportTicket withId(SupportTicket t) {
        ReflectionTestUtils.setField(t, "id", ticketId);
        return t;
    }

    private SupportTicket.SupportTicketBuilder baseTicket(UUID owner) {
        return SupportTicket.builder().userId(owner).subject("Help").category(SupportTicket.Category.BUG_REPORT)
                .description("Something broke").status(SupportTicket.Status.OPEN).priority(SupportTicket.Priority.MEDIUM);
    }

    // ─── createTicket ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("notifies every admin when a new ticket is created")
    void notifiesAllAdmins() {
        CreateTicketRequest req = mock(CreateTicketRequest.class);
        when(req.getSubject()).thenReturn("Bug in dashboard");
        when(req.getCategory()).thenReturn(SupportTicket.Category.BUG_REPORT);
        when(req.getDescription()).thenReturn("Something is broken");
        when(ticketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
        User admin1 = User.builder().role(UserRole.ADMIN).build();
        User admin2 = User.builder().role(UserRole.ADMIN).build();
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of(admin1, admin2));
        when(userRepository.findById(userId)).thenReturn(Optional.of(User.builder().fullName("Alice").build()));

        service.createTicket(userId, req);

        verify(notificationRepository, times(2)).save(any());
    }

    @Test
    @DisplayName("creates no notifications when there are no admins")
    void noNotificationsWhenNoAdmins() {
        CreateTicketRequest req = mock(CreateTicketRequest.class);
        when(req.getCategory()).thenReturn(SupportTicket.Category.BUG_REPORT);
        when(ticketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
        when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of());
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        service.createTicket(userId, req);

        verifyNoInteractions(notificationRepository);
    }

    // ─── getTicket: ownership guard ──────────────────────────────────────────────

    @Nested
    @DisplayName("getTicket: ownership guard")
    class GetTicketOwnershipTests {

        @Test
        @DisplayName("throws when the ticket doesn't exist")
        void throwsWhenNotFound() {
            when(ticketRepository.findById(ticketId)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.getTicket(ticketId, userId)).isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("a non-admin cannot view another user's ticket")
        void nonAdminCannotViewOthersTicket() {
            SupportTicket ticket = withId(baseTicket(UUID.randomUUID()).build());
            when(ticketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(userRepository.findById(userId)).thenReturn(Optional.of(User.builder().role(UserRole.MEMBER).build()));

            assertThatThrownBy(() -> service.getTicket(ticketId, userId)).isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("an ADMIN can view any user's ticket")
        void adminCanViewAnyTicket() {
            SupportTicket ticket = withId(baseTicket(UUID.randomUUID()).build());
            when(ticketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(userRepository.findById(userId)).thenReturn(Optional.of(User.builder().role(UserRole.ADMIN).build()));

            TicketResponse response = service.getTicket(ticketId, userId);

            assertThat(response.getSubject()).isEqualTo("Help");
        }

        @Test
        @DisplayName("the owner can view their own ticket")
        void ownerCanViewOwnTicket() {
            SupportTicket ticket = withId(baseTicket(userId).build());
            when(ticketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(userRepository.findById(userId)).thenReturn(Optional.of(User.builder().role(UserRole.MEMBER).build()));

            TicketResponse response = service.getTicket(ticketId, userId);

            assertThat(response.getSubject()).isEqualTo("Help");
        }
    }

    // ─── addReply ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("addReply")
    class AddReplyTests {

        @Test
        @DisplayName("a non-admin cannot reply to another user's ticket")
        void nonAdminCannotReplyToOthersTicket() {
            SupportTicket ticket = withId(baseTicket(UUID.randomUUID()).build());
            when(ticketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            ReplyRequest req = mock(ReplyRequest.class);

            assertThatThrownBy(() -> service.addReply(ticketId, userId, req, false)).isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("an admin's reply on an OPEN ticket auto-transitions it to IN_PROGRESS")
        void adminReplyAutoTransitionsOpenTicket() {
            SupportTicket ticket = withId(baseTicket(UUID.randomUUID()).status(SupportTicket.Status.OPEN).build());
            when(ticketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(ticketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> inv.getArgument(0));
            ReplyRequest req = mock(ReplyRequest.class);
            when(req.getMessage()).thenReturn("Looking into it");
            when(userRepository.findById(any())).thenReturn(Optional.of(User.builder().fullName("Support").build()));

            service.addReply(ticketId, UUID.randomUUID(), req, true);

            assertThat(ticket.getStatus()).isEqualTo(SupportTicket.Status.IN_PROGRESS);
        }

        @Test
        @DisplayName("an admin's reply does NOT transition a ticket that isn't OPEN")
        void adminReplyDoesNotTransitionNonOpenTicket() {
            SupportTicket ticket = withId(baseTicket(UUID.randomUUID()).status(SupportTicket.Status.RESOLVED).build());
            when(ticketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            ReplyRequest req = mock(ReplyRequest.class);
            when(req.getMessage()).thenReturn("Following up");
            when(userRepository.findById(any())).thenReturn(Optional.of(User.builder().fullName("Support").build()));

            service.addReply(ticketId, UUID.randomUUID(), req, true);

            assertThat(ticket.getStatus()).isEqualTo(SupportTicket.Status.RESOLVED);
            verify(ticketRepository, never()).save(any());
        }

        @Test
        @DisplayName("notifies the ticket owner when an admin (someone else) replies")
        void notifiesOwnerOnAdminReply() {
            UUID ownerId = UUID.randomUUID();
            SupportTicket ticket = withId(baseTicket(ownerId).status(SupportTicket.Status.IN_PROGRESS).build());
            when(ticketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            ReplyRequest req = mock(ReplyRequest.class);
            when(req.getMessage()).thenReturn("Reply text");
            when(userRepository.findById(any())).thenReturn(Optional.of(User.builder().fullName("Support").build()));

            service.addReply(ticketId, UUID.randomUUID(), req, true);

            verify(notificationRepository).save(argThat(n -> n.getUserId().equals(ownerId) && n.getType().equals("TICKET_REPLY")));
        }

        @Test
        @DisplayName("does NOT notify when the owner replies to their own ticket")
        void noSelfNotificationOnOwnReply() {
            SupportTicket ticket = withId(baseTicket(userId).status(SupportTicket.Status.OPEN).build());
            when(ticketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            ReplyRequest req = mock(ReplyRequest.class);
            when(req.getMessage()).thenReturn("More info");

            service.addReply(ticketId, userId, req, false);

            verifyNoInteractions(notificationRepository);
        }
    }

    // ─── updateStatus ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateStatus")
    class UpdateStatusTests {

        @Test
        @DisplayName("notifies the ticket owner when moved to RESOLVED")
        void notifiesOwnerOnResolved() {
            UUID ownerId = UUID.randomUUID();
            SupportTicket ticket = withId(baseTicket(ownerId).build());
            when(ticketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(ticketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> inv.getArgument(0));

            service.updateStatus(ticketId, SupportTicket.Status.RESOLVED, null);

            verify(notificationRepository).save(argThat(n -> n.getUserId().equals(ownerId)));
        }

        @Test
        @DisplayName("does NOT notify for a status change that isn't RESOLVED or CLOSED")
        void noNotificationForOtherStatusChanges() {
            SupportTicket ticket = withId(baseTicket(userId).build());
            when(ticketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(ticketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> inv.getArgument(0));

            service.updateStatus(ticketId, SupportTicket.Status.IN_PROGRESS, null);

            verifyNoInteractions(notificationRepository);
        }

        @Test
        @DisplayName("only updates the fields provided (status-only or priority-only)")
        void partialUpdate() {
            SupportTicket ticket = withId(baseTicket(userId).priority(SupportTicket.Priority.LOW).build());
            when(ticketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(ticketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> inv.getArgument(0));

            service.updateStatus(ticketId, null, SupportTicket.Priority.URGENT);

            assertThat(ticket.getStatus()).isEqualTo(SupportTicket.Status.OPEN); // unchanged
            assertThat(ticket.getPriority()).isEqualTo(SupportTicket.Priority.URGENT);
        }
    }
}
