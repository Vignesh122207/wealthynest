package com.wealthynest.domain.support.controller;

import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.support.dto.CreateTicketRequest;
import com.wealthynest.domain.support.dto.ReplyRequest;
import com.wealthynest.domain.support.dto.TicketResponse;
import com.wealthynest.domain.support.service.SupportTicketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/support/tickets")
@RequiredArgsConstructor
public class SupportTicketController {

    private final SupportTicketService service;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TicketResponse> create(@Valid @RequestBody CreateTicketRequest req) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        return ResponseEntity.ok(service.createTicket(userId, req));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PagedResponse<TicketResponse>> listMine(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        Page<TicketResponse> p = service.getMyTickets(userId, PageRequest.of(page, size));
        return ResponseEntity.ok(PagedResponse.of(p));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TicketResponse> get(@PathVariable UUID id) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        return ResponseEntity.ok(service.getTicket(id, userId));
    }

    @PostMapping("/{id}/replies")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TicketResponse> reply(@PathVariable UUID id,
                                                @Valid @RequestBody ReplyRequest req) {
        UUID userId  = SecurityUtils.requireCurrentUserId();
        return ResponseEntity.ok(service.addReply(id, userId, req, false));
    }
}
