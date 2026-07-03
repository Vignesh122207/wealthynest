package com.wealthynest.domain.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "job_schedule_config")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class JobScheduleConfig {

    @Id
    @Column(name = "job_name", length = 50)
    private String jobName;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(name = "cron_expression", nullable = false, length = 100)
    private String cronExpression;

    @Column(nullable = false, length = 50)
    private String timezone;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "last_run_at")
    private Instant lastRunAt;

    @Column(name = "last_run_status", length = 20)
    private String lastRunStatus;   // SUCCESS | FAILED | RUNNING

    @Column(name = "last_run_message", columnDefinition = "TEXT")
    private String lastRunMessage;
}
