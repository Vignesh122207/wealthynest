package com.wealthynest.config;

import com.wealthynest.common.security.SecurityUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;

import java.util.UUID;

@Configuration
public class AuditConfig {
    @Bean
    public AuditorAware<UUID> auditorAware() {
        return SecurityUtils::getCurrentUserId;
    }
}
