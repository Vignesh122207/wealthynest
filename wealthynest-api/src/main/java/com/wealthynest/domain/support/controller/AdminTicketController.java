package com.wealthynest.domain.support.controller;

import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.support.dto.ReplyRequest;
import com.wealthynest.domain.support.dto.TicketResponse;
import com.wealthynest.domain.support.entity.SupportTicket;
import com.wealthynest.domain.support.service.SupportTicketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/tickets")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminTicketController {

    private final SupportTicketService service;

    @GetMapping
    public ResponseEntity<PagedResponse<TicketResponse>> list(
            @RequestParam(required = false) SupportTicket.Status status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<TicketResponse> p = service.getAllTickets(status, PageRequest.of(page, size));
        return ResponseEntity.ok(PagedResponse.of(p));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TicketResponse> get(@PathVariable UUID id) {
        UUID adminId = SecurityUtils.requireCurrentUserId();
        return ResponseEntity.ok(service.getTicket(id, adminId));
    }

    @PostMapping("/{id}/replies")
    public ResponseEntity<TicketResponse> reply(@PathVariable UUID id,
                                                @Valid @RequestBody ReplyRequest req) {
        UUID adminId = SecurityUtils.requireCurrentUserId();
        return ResponseEntity.ok(service.addReply(id, adminId, req, true));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<TicketResponse> updateStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body) {
        SupportTicket.Status   status   = body.containsKey("status")   ? SupportTicket.Status.valueOf(body.get("status"))     : null;
        SupportTicket.Priority priority = body.containsKey("priority") ? SupportTicket.Priority.valueOf(body.get("priority")) : null;
        return ResponseEntity.ok(service.updateStatus(id, status, priority));
    }

    @GetMapping("/count/open")
    public ResponseEntity<Map<String, Long>> countOpen() {
        return ResponseEntity.ok(Map.of("count", service.countOpen()));
    }
}
