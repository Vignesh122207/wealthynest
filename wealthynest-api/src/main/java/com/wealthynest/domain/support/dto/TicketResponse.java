package com.wealthynest.domain.support.dto;

import com.wealthynest.domain.support.entity.SupportTicket;
import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data @Builder
public class TicketResponse {
    private UUID   id;
    private String subject;
    private SupportTicket.Category category;
    private String description;
    private SupportTicket.Status   status;
    private SupportTicket.Priority priority;
    private String userName;
    private String userEmail;
    private Instant createdAt;
    private Instant updatedAt;
    private int     replyCount;
    private List<ReplyResponse> replies;

    @Data @Builder
    public static class ReplyResponse {
        private UUID    id;
        private String  message;
        private boolean adminReply;
        private String  authorName;
        private Instant createdAt;
    }
}
