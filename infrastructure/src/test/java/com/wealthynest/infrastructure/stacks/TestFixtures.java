package com.wealthynest.infrastructure.stacks;

import com.wealthynest.infrastructure.config.AppConfig;
import java.util.List;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;

/** Shared, hand-built (not context-loaded) test data - keeps each stack test isolated from cdk.json. */
final class TestFixtures {

    static final String ACCOUNT = "123456789012";
    static final String REGION = "ap-south-1";

    private TestFixtures() {
    }

    static StackProps stackProps() {
        return StackProps.builder()
            .env(Environment.builder().account(ACCOUNT).region(REGION).build())
            .build();
    }

    static AppConfig appConfig() {
        return appConfig(false);
    }

    static AppConfig appConfig(boolean natGatewayEnabled) {
        return new AppConfig(
            "test",
            ACCOUNT,
            REGION,
            "wealthynest.in",
            "api.wealthynest.in",
            true,
            "test-owner/wealthynest",
            new AppConfig.NetworkConfig(
                "10.20.0.0/16",
                natGatewayEnabled,
                List.of("ap-south-1a", "ap-south-1b")
            ),
            new AppConfig.ComputeConfig(
                "t4g.small",
                "arm64",
                30,
                "",
                List.of("173.245.48.0/20", "103.21.244.0/22"),
                List.of("2400:cb00::/32")
            ),
            new AppConfig.DatabaseConfig(
                "t4g.micro",
                20,
                100,
                false,
                true,
                7,
                7,
                30
            ),
            new AppConfig.RedisConfig("cache.t4g.micro", 1),
            new AppConfig.StorageConfig(30, 365, 30),
            new AppConfig.MonitoringConfig("ops@example.com", 90)
        );
    }
}
