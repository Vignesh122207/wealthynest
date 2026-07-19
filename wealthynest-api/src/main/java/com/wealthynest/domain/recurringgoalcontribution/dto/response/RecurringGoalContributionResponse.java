package com.wealthynest.domain.recurringgoalcontribution.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class RecurringGoalContributionResponse {
    private UUID          id;
    private UUID          goalId;
    private String        goalName;
    private String        goalIcon;
    private String        goalColor;
    private BigDecimal    amount;
    private int           dayOfMonth;
    private boolean       active;
    private Integer       lastContributedMonth;
    private LocalDateTime lastContributedAt;
    private Instant       createdAt;
}
