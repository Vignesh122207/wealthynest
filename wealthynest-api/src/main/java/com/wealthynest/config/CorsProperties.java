package com.wealthynest.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import java.util.List;

@Getter
@Setter
@ConfigurationProperties(prefix = "wealthynest.security.cors")
public class CorsProperties {
    private List<String> allowedOrigins = List.of("http://localhost:3000");
}
