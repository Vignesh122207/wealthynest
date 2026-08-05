package com.wealthynest;

import com.wealthynest.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Boots the full application context against real Postgres + Redis (via
 * AbstractIntegrationTest) and runs every Flyway migration for real — including
 * support_tickets, which the H2-backed WealthyNestApplicationTest cannot create because
 * H2 doesn't understand Postgres's native `ticket_category` enum type.
 */
@SpringBootTest
class ApplicationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void contextLoads() {
    }

    @Test
    void allMigrationsAppliedIncludingNativeEnumTables() {
        Integer version = jdbcTemplate.queryForObject(
                "SELECT MAX(version::int) FROM flyway_schema_history WHERE success = true",
                Integer.class);
        assertThat(version).isEqualTo(57);

        Integer supportTicketsExists = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'support_tickets'",
                Integer.class);
        assertThat(supportTicketsExists).isEqualTo(1);

        Integer categoryColumnType = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns " +
                        "WHERE table_name = 'support_tickets' AND column_name = 'category' AND udt_name = 'ticket_category'",
                Integer.class);
        assertThat(categoryColumnType).isEqualTo(1);
    }
}
