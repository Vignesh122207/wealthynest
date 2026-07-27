package com.wealthynest.domain.goal.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter @Builder
public class GoalResponse {
    private UUID       id;
    private String     name;
    private String     icon;
    private String     color;
    private BigDecimal targetAmount;
    private BigDecimal savedAmount;
    private LocalDate  targetDate;
    private double     percentSaved;
    private Instant    createdAt;
    private UUID       accountId;
    private String     accountName;
    private boolean    paused;
    private boolean    shared;
}
