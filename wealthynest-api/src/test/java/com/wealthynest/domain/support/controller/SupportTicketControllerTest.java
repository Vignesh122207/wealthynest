package com.wealthynest.domain.support.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.support.dto.CreateTicketRequest;
import com.wealthynest.domain.support.dto.ReplyRequest;
import com.wealthynest.domain.support.dto.TicketResponse;
import com.wealthynest.domain.support.entity.SupportTicket;
import com.wealthynest.domain.support.service.SupportTicketService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Unlike most controllers, SupportTicketController returns TicketResponse/PagedResponse directly
 * — not wrapped in ApiResponse — so its response-body assertions look different from the rest of
 * the suite. Also verifies reply() always passes isAdminReply=false, since regular users must
 * never be able to post a reply that reads as an admin response (that's AdminTicketController's job).
 */
@WebMvcTest(controllers = SupportTicketController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class SupportTicketControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private SupportTicketService supportTicketService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateTicketRequest validRequest() {
        CreateTicketRequest req = new CreateTicketRequest();
        req.setSubject("App crashes on login");
        req.setCategory(SupportTicket.Category.BUG_REPORT);
        req.setDescription("Steps to reproduce: open app, tap login, app crashes immediately.");
        return req;
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/support/tickets"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(supportTicketService);
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a subject shorter than 5 chars fails @Size validation")
        void tooShortSubjectFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateTicketRequest req = validRequest();
            req.setSubject("Bug");

            mockMvc.perform(post("/api/v1/support/tickets")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.subject").exists());
        }

        @Test
        @DisplayName("a description shorter than 10 chars fails @Size validation")
        void tooShortDescriptionFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateTicketRequest req = validRequest();
            req.setDescription("short");

            mockMvc.perform(post("/api/v1/support/tickets")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.description").exists());
        }
    }

    @Test
    @DisplayName("GET /support/tickets returns a paged response (not wrapped in ApiResponse)")
    void listMineReturnsPagedResponse() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        Page<TicketResponse> page = new PageImpl<>(List.of(TicketResponse.builder().id(UUID.randomUUID()).build()),
                Pageable.ofSize(20), 1);
        when(supportTicketService.getMyTickets(eq(userId), any())).thenReturn(page);

        mockMvc.perform(get("/api/v1/support/tickets"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    @DisplayName("POST /support/tickets/{id}/replies always passes isAdminReply=false for a regular user")
    void replyAlwaysPassesNonAdminFlag() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID ticketId = UUID.randomUUID();
        ReplyRequest req = new ReplyRequest();
        req.setMessage("Any update on this?");
        when(supportTicketService.addReply(eq(ticketId), eq(userId), any(), eq(false)))
                .thenReturn(TicketResponse.builder().id(ticketId).build());

        mockMvc.perform(post("/api/v1/support/tickets/{id}/replies", ticketId)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(supportTicketService).addReply(ticketId, userId, req, false);
    }
}
