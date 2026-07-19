package com.wealthynest.testsupport;

import org.junit.jupiter.api.Tag;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Base class for tests that need a real Postgres + Redis rather than H2/no-cache.
 *
 * Containers are started once per JVM (singleton pattern, not per test class) and never
 * explicitly stopped — Testcontainers' Ryuk sidecar reaps them when the test JVM exits.
 * Every subclass sharing this base reuses the same two containers, so the Postgres/Redis
 * startup cost (a few seconds) is paid once per `mvn test` run, not once per test class.
 *
 * Runs against real Postgres specifically because H2 can't parse Postgres-native enum
 * columns (e.g. support_tickets.category) — see application-test.yml's H2 profile, which
 * has to disable Flyway and fall back to Hibernate ddl-auto for that reason. Anything that
 * touches a native-enum table, or needs to verify real Flyway migration behavior, belongs
 * here instead of the plain @SpringBootTest + H2 setup.
 */
@ActiveProfiles("itest")
@Tag("integration")
public abstract class AbstractIntegrationTest {

    protected static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"))
                    .withDatabaseName("wealthynest_test")
                    .withUsername("wealthynest")
                    .withPassword("wealthynest")
                    .withReuse(true);

    protected static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
                    .withExposedPorts(6379)
                    .withReuse(true);

    static {
        POSTGRES.start();
        REDIS.start();
    }

    @DynamicPropertySource
    static void registerContainerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    }
}
