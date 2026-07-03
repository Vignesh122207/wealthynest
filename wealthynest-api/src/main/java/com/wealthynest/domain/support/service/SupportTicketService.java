package com.wealthynest.domain.support.service;

import com.wealthynest.domain.support.dto.CreateTicketRequest;
import com.wealthynest.domain.support.dto.ReplyRequest;
import com.wealthynest.domain.support.dto.TicketResponse;
import com.wealthynest.domain.support.entity.SupportTicket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.UUID;

public interface SupportTicketService {

    // User operations
    TicketResponse createTicket(UUID userId, CreateTicketRequest req);
    Page<TicketResponse> getMyTickets(UUID userId, Pageable pageable);
    TicketResponse getTicket(UUID ticketId, UUID userId);
    TicketResponse addReply(UUID ticketId, UUID userId, ReplyRequest req, boolean isAdmin);

    // Admin operations
    Page<TicketResponse> getAllTickets(SupportTicket.Status status, Pageable pageable);
    TicketResponse updateStatus(UUID ticketId, SupportTicket.Status status, SupportTicket.Priority priority);
    long countOpen();
}
