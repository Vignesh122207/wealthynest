package com.wealthynest.domain.support.service;

import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.notification.entity.Notification;
import com.wealthynest.domain.notification.repository.NotificationRepository;
import com.wealthynest.domain.support.dto.CreateTicketRequest;
import com.wealthynest.domain.support.dto.ReplyRequest;
import com.wealthynest.domain.support.dto.TicketResponse;
import com.wealthynest.domain.support.entity.SupportTicket;
import com.wealthynest.domain.support.entity.TicketReply;
import com.wealthynest.domain.support.repository.SupportTicketRepository;
import com.wealthynest.domain.support.repository.TicketReplyRepository;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.entity.UserRole;
import com.wealthynest.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SupportTicketServiceImpl implements SupportTicketService {

    private final SupportTicketRepository ticketRepository;
    private final TicketReplyRepository   replyRepository;
    private final UserRepository          userRepository;
    private final NotificationRepository  notificationRepository;

    // ─── User: create ─────────────────────────────────────────────────────────

    @Override @Transactional
    public TicketResponse createTicket(UUID userId, CreateTicketRequest req) {
        SupportTicket ticket = SupportTicket.builder()
                .userId(userId)
                .subject(req.getSubject())
                .category(req.getCategory())
                .description(req.getDescription())
                .build();
        ticket = ticketRepository.save(ticket);

        // Notify all admins in-app
        List<User> admins = userRepository.findAll().stream()
                .filter(u -> UserRole.ADMIN.equals(u.getRole()))
                .collect(Collectors.toList());
        User submitter = userRepository.findById(userId).orElse(null);
        String submitterName = submitter != null ? submitter.getFullName() : "A user";
        for (User admin : admins) {
            notificationRepository.save(Notification.builder()
                    .userId(admin.getId())
                    .type("SUPPORT_TICKET")
                    .title("New support ticket")
                    .message(submitterName + " opened: " + req.getSubject())
                    .build());
        }
        return toResponse(ticket, List.of());
    }

    // ─── User: list own ───────────────────────────────────────────────────────

    @Override @Transactional(readOnly = true)
    public Page<TicketResponse> getMyTickets(UUID userId, Pageable pageable) {
        return ticketRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(t -> toResponse(t, List.of()));
    }

    // ─── User/Admin: view thread ──────────────────────────────────────────────

    @Override @Transactional(readOnly = true)
    public TicketResponse getTicket(UUID ticketId, UUID requesterId) {
        SupportTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("SupportTicket", "id", "not found"));

        // Non-admins can only view their own tickets
        User requester = userRepository.findById(requesterId).orElseThrow();
        boolean isAdmin = "ADMIN".equals(requester.getRole() != null ? requester.getRole().name() : "");
        if (!isAdmin && !ticket.getUserId().equals(requesterId)) {
            throw new AccessDeniedException("Not your ticket");
        }

        List<TicketReply> replies = replyRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);
        Set<UUID> userIds = replies.stream().map(TicketReply::getUserId).collect(Collectors.toSet());
        userIds.add(ticket.getUserId());
        Map<UUID, String> names = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName));

        return toResponseWithUser(ticket, replies, names);
    }

    // ─── User/Admin: reply ────────────────────────────────────────────────────

    @Override @Transactional
    public TicketResponse addReply(UUID ticketId, UUID userId, ReplyRequest req, boolean isAdmin) {
        SupportTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("SupportTicket", "id", "not found"));

        if (!isAdmin && !ticket.getUserId().equals(userId)) {
            throw new AccessDeniedException("Not your ticket");
        }

        // Auto-transition status on reply
        if (isAdmin && ticket.getStatus() == SupportTicket.Status.OPEN) {
            ticket.setStatus(SupportTicket.Status.IN_PROGRESS);
            ticketRepository.save(ticket);
        }

        TicketReply reply = TicketReply.builder()
                .ticketId(ticketId)
                .userId(userId)
                .message(req.getMessage())
                .adminReply(isAdmin)
                .build();
        replyRepository.save(reply);

        // Notify ticket owner when admin replies
        if (isAdmin && !ticket.getUserId().equals(userId)) {
            User admin = userRepository.findById(userId).orElse(null);
            String adminName = admin != null ? admin.getFullName() : "Support";
            notificationRepository.save(Notification.builder()
                    .userId(ticket.getUserId())
                    .type("TICKET_REPLY")
                    .title("Reply on your ticket")
                    .message(adminName + " replied to: " + ticket.getSubject())
                    .build());
        }

        List<TicketReply> replies = replyRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);
        Set<UUID> userIds = replies.stream().map(TicketReply::getUserId).collect(Collectors.toSet());
        userIds.add(ticket.getUserId());
        Map<UUID, String> names = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName));

        return toResponseWithUser(ticket, replies, names);
    }

    // ─── Admin: list all ──────────────────────────────────────────────────────

    @Override @Transactional(readOnly = true)
    public Page<TicketResponse> getAllTickets(SupportTicket.Status status, Pageable pageable) {
        Page<SupportTicket> page = (status != null)
                ? ticketRepository.findByStatusOrderByCreatedAtDesc(status, pageable)
                : ticketRepository.findAllByOrderByCreatedAtDesc(pageable);
        return page.map(t -> toResponse(t, List.of()));
    }

    // ─── Admin: update status / priority ──────────────────────────────────────

    @Override @Transactional
    public TicketResponse updateStatus(UUID ticketId, SupportTicket.Status status, SupportTicket.Priority priority) {
        SupportTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("SupportTicket", "id", "not found"));
        if (status   != null) ticket.setStatus(status);
        if (priority != null) ticket.setPriority(priority);
        ticket = ticketRepository.save(ticket);

        // Notify user when ticket is resolved/closed
        if (status == SupportTicket.Status.RESOLVED || status == SupportTicket.Status.CLOSED) {
            notificationRepository.save(Notification.builder()
                    .userId(ticket.getUserId())
                    .type("TICKET_REPLY")
                    .title("Ticket " + status.name().toLowerCase())
                    .message("Your ticket \"" + ticket.getSubject() + "\" has been " + status.name().toLowerCase() + ".")
                    .build());
        }

        List<TicketReply> replies = replyRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);
        Set<UUID> userIds = replies.stream().map(TicketReply::getUserId).collect(Collectors.toSet());
        userIds.add(ticket.getUserId());
        Map<UUID, String> names = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName));

        return toResponseWithUser(ticket, replies, names);
    }

    @Override @Transactional(readOnly = true)
    public long countOpen() {
        return ticketRepository.countOpen();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private TicketResponse toResponse(SupportTicket t, List<TicketReply> replies) {
        return TicketResponse.builder()
                .id(t.getId()).subject(t.getSubject()).category(t.getCategory())
                .description(t.getDescription()).status(t.getStatus()).priority(t.getPriority())
                .createdAt(t.getCreatedAt()).updatedAt(t.getUpdatedAt())
                .replyCount(replies.size()).build();
    }

    private TicketResponse toResponseWithUser(SupportTicket t, List<TicketReply> replies, Map<UUID, String> names) {
        List<TicketResponse.ReplyResponse> replyDtos = replies.stream()
                .map(r -> TicketResponse.ReplyResponse.builder()
                        .id(r.getId()).message(r.getMessage()).adminReply(r.isAdminReply())
                        .authorName(names.getOrDefault(r.getUserId(), "Unknown"))
                        .createdAt(r.getCreatedAt()).build())
                .collect(Collectors.toList());

        return TicketResponse.builder()
                .id(t.getId()).subject(t.getSubject()).category(t.getCategory())
                .description(t.getDescription()).status(t.getStatus()).priority(t.getPriority())
                .userName(names.getOrDefault(t.getUserId(), "Unknown"))
                .createdAt(t.getCreatedAt()).updatedAt(t.getUpdatedAt())
                .replyCount(replyDtos.size()).replies(replyDtos).build();
    }
}
