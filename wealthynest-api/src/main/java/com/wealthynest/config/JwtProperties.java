package com.wealthynest.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "wealthynest.security.jwt")
public class JwtProperties {
    private String secret;
    private long accessTokenExpiryMs;
    private long refreshTokenExpiryMs;

    @PostConstruct
    public void validate() {
        if (secret == null
                || "change-this-secret-in-production-min-256-bits-long".equals(secret)
                || secret.length() < 32) {
            throw new IllegalStateException(
                    "FATAL: JWT_SECRET is not configured or is using the insecure default value. " +
                            "Set the JWT_SECRET environment variable to a unique random string of at least 32 characters.");
        }
    }
}
