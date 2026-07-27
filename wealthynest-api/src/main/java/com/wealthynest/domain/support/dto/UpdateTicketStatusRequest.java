package com.wealthynest.domain.support.dto;

import com.wealthynest.domain.support.entity.SupportTicket;
import lombok.Data;

/** Both fields are optional and applied independently — status-only and priority-only updates
 * are both valid calls. Typed enums (vs the raw string map this replaced) mean an invalid value
 * fails deserialization as a clean 400 via GlobalExceptionHandler's existing
 * HttpMessageNotReadableException handler, instead of an unhandled IllegalArgumentException from
 * a manual Enum.valueOf() falling through to the generic 500 handler. */
@Data
public class UpdateTicketStatusRequest {
    private SupportTicket.Status   status;
    private SupportTicket.Priority priority;
}
