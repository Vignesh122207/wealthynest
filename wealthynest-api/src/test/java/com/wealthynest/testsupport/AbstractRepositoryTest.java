package com.wealthynest.testsupport;

import com.wealthynest.config.AuditConfig;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

/**
 * Base for repository-layer tests: a real Postgres (via AbstractIntegrationTest's Testcontainers)
 * with Flyway actually running the full migration set, not Hibernate's ddl-auto against H2. That
 * matters here specifically — H2 can't parse the native Postgres enum types a few tables use (see
 * ApplicationIntegrationTest), and more generally, a hand-written @Query is exactly the kind of
 * thing that "compiles fine, wrong at runtime" — worth verifying against the real database engine
 * rather than an approximation of one.
 *
 * @DataJpaTest wraps each test in a transaction that's rolled back afterward, so tests can freely
 * persist fixture rows via TestEntityManager/the repository under test without cleaning up.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("itest")
// @DataJpaTest only auto-configures JPA infra (entities, repositories) — it does not pick up
// regular @Configuration beans, so the auditorAware bean that @CreatedBy/@LastModifiedBy
// (BaseEntity, via AuditingEntityListener) resolves against has to be imported explicitly.
@Import(AuditConfig.class)
public abstract class AbstractRepositoryTest extends AbstractIntegrationTest {
}
