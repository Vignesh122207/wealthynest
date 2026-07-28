package com.wealthynest.domain.support.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.support.dto.ReplyRequest;
import com.wealthynest.domain.support.dto.TicketResponse;
import com.wealthynest.domain.support.entity.SupportTicket;
import com.wealthynest.domain.support.service.SupportTicketService;
import com.wealthynest.domain.user.entity.UserRole;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AdminTicketController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class AdminTicketControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private SupportTicketService supportTicketService;

    private final UUID adminId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Test
    @DisplayName("a non-admin MEMBER is rejected with 403 from the class-level hasRole('ADMIN') check")
    void nonAdminIsForbidden() throws Exception {
        SecurityTestUtils.authenticateAs(adminId, null, UserRole.MEMBER);

        mockMvc.perform(get("/api/v1/admin/tickets"))
                .andExpect(status().isForbidden());

        org.mockito.Mockito.verifyNoInteractions(supportTicketService);
    }

    @Test
    @DisplayName("an unauthenticated request is rejected with 401")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/admin/tickets"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("an admin reply always passes isAdminReply=true, unlike SupportTicketController's regular-user reply")
    void adminReplyAlwaysPassesAdminFlag() throws Exception {
        SecurityTestUtils.authenticateAs(adminId, null, UserRole.ADMIN);
        UUID ticketId = UUID.randomUUID();
        ReplyRequest req = new ReplyRequest();
        req.setMessage("We're looking into this.");
        when(supportTicketService.addReply(eq(ticketId), eq(adminId), any(), eq(true)))
                .thenReturn(TicketResponse.builder().id(ticketId).build());

        mockMvc.perform(post("/api/v1/admin/tickets/{id}/replies", ticketId)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(supportTicketService).addReply(ticketId, adminId, req, true);
    }

    @Test
    @DisplayName("updateStatus parses status and priority from the request body")
    void updateStatusParsesBody() throws Exception {
        SecurityTestUtils.authenticateAs(adminId, null, UserRole.ADMIN);
        UUID ticketId = UUID.randomUUID();
        when(supportTicketService.updateStatus(ticketId, SupportTicket.Status.RESOLVED, SupportTicket.Priority.HIGH))
                .thenReturn(TicketResponse.builder().id(ticketId).build());

        mockMvc.perform(patch("/api/v1/admin/tickets/{id}/status", ticketId)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("status", "RESOLVED", "priority", "HIGH"))))
                .andExpect(status().isOk());

        verify(supportTicketService).updateStatus(ticketId, SupportTicket.Status.RESOLVED, SupportTicket.Priority.HIGH);
    }

    @Test
    @DisplayName("updateStatus rejects an invalid enum value with a clean 400 instead of a 500")
    void updateStatusRejectsInvalidEnumValue() throws Exception {
        SecurityTestUtils.authenticateAs(adminId, null, UserRole.ADMIN);
        UUID ticketId = UUID.randomUUID();

        mockMvc.perform(patch("/api/v1/admin/tickets/{id}/status", ticketId)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("status", "NOT_A_REAL_STATUS"))))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(supportTicketService);
    }

    @Test
    @DisplayName("GET /admin/tickets/count/open returns the raw {count: N} map")
    void countOpenReturnsRawMap() throws Exception {
        SecurityTestUtils.authenticateAs(adminId, null, UserRole.ADMIN);
        when(supportTicketService.countOpen()).thenReturn(7L);

        mockMvc.perform(get("/api/v1/admin/tickets/count/open"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(7));
    }
}
