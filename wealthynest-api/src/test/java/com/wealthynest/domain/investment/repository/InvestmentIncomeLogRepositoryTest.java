package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.asset.entity.Asset;
import com.wealthynest.domain.asset.entity.AssetType;
import com.wealthynest.domain.income.entity.IncomeEntry;
import com.wealthynest.domain.income.entity.IncomeSource;
import com.wealthynest.domain.investment.entity.Investment;
import com.wealthynest.domain.investment.entity.InvestmentIncomeLog;
import com.wealthynest.domain.investment.entity.InvestmentType;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class InvestmentIncomeLogRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private InvestmentIncomeLogRepository investmentIncomeLogRepository;

    private UUID userId;
    private UUID investmentId;

    @BeforeEach
    void seedUserAssetAndInvestment() {
        User user = User.builder().fullName("Vera").email("vera-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();

        Asset asset = Asset.builder().userId(userId).name("Bond").assetType(AssetType.BOND)
                .currentValue(BigDecimal.ZERO).asOfDate(LocalDate.now()).build();
        entityManager.persist(asset);

        Investment investment = Investment.builder().userId(userId).assetId(asset.getId())
                .investmentType(InvestmentType.BOND).investedAmount(new BigDecimal("10000"))
                .currentValue(new BigDecimal("10000")).build();
        entityManager.persist(investment);
        investmentId = investment.getId();

        entityManager.flush();
    }

    private InvestmentIncomeLog persistLog(String incomeType, LocalDate eventDate, BigDecimal amount) {
        InvestmentIncomeLog log = InvestmentIncomeLog.builder().investmentId(investmentId).userId(userId)
                .incomeType(incomeType).eventDate(eventDate).amount(amount).build();
        entityManager.persist(log);
        return log;
    }

    @Test
    @DisplayName("existsByInvestmentIdAndIncomeTypeAndEventDate detects a duplicate credit for the same event")
    void existsDetectsDuplicateCredit() {
        persistLog("COUPON", LocalDate.of(2026, 6, 1), new BigDecimal("100"));
        entityManager.flush();

        assertThat(investmentIncomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                investmentId, "COUPON", LocalDate.of(2026, 6, 1))).isTrue();
        assertThat(investmentIncomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                investmentId, "COUPON", LocalDate.of(2026, 7, 1))).isFalse();
    }

    @Test
    @DisplayName("findByUserIdAndYear scopes to the calendar year and orders newest-first")
    void findByUserAndYearScopesToCalendarYear() {
        InvestmentIncomeLog inYear = persistLog("COUPON", LocalDate.of(2026, 6, 1), new BigDecimal("100"));
        persistLog("COUPON", LocalDate.of(2025, 12, 31), new BigDecimal("999")); // prior year — excluded
        entityManager.flush();

        List<InvestmentIncomeLog> result = investmentIncomeLogRepository.findByUserIdAndYear(userId, 2026);

        assertThat(result).extracting(InvestmentIncomeLog::getId).containsExactly(inYear.getId());
    }

    @Test
    @DisplayName("sumByUserAndIncomeType filters strictly by income type")
    void sumByUserAndIncomeTypeFiltersStrictly() {
        persistLog("COUPON", LocalDate.of(2026, 6, 1), new BigDecimal("100"));
        persistLog("DIVIDEND", LocalDate.of(2026, 6, 2), new BigDecimal("999"));
        entityManager.flush();

        assertThat(investmentIncomeLogRepository.sumByUserAndIncomeType(userId, "COUPON")).isEqualByComparingTo("100");
    }

    @Test
    @DisplayName("findByInvestmentId returns all logs for the investment")
    void findByInvestmentIdReturnsAll() {
        persistLog("COUPON", LocalDate.of(2026, 6, 1), new BigDecimal("100"));
        persistLog("COUPON", LocalDate.of(2026, 9, 1), new BigDecimal("100"));
        entityManager.flush();

        assertThat(investmentIncomeLogRepository.findByInvestmentId(investmentId)).hasSize(2);
    }

    @Test
    @DisplayName("clearIncomeEntryId nulls the reference without deleting the log row")
    void clearIncomeEntryIdNullsReference() {
        IncomeEntry incomeEntry = IncomeEntry.builder().userId(userId).source(IncomeSource.INTEREST)
                .amount(new BigDecimal("100")).incomeDate(LocalDate.of(2026, 6, 1))
                .periodMonth(6).periodYear(2026).build();
        entityManager.persist(incomeEntry);
        InvestmentIncomeLog log = persistLog("COUPON", LocalDate.of(2026, 6, 1), new BigDecimal("100"));
        log.setIncomeEntryId(incomeEntry.getId());
        entityManager.persist(log);
        entityManager.flush();
        entityManager.clear();

        investmentIncomeLogRepository.clearIncomeEntryId(incomeEntry.getId());
        entityManager.clear();

        InvestmentIncomeLog reloaded = entityManager.find(InvestmentIncomeLog.class, log.getId());
        assertThat(reloaded).isNotNull();
        assertThat(reloaded.getIncomeEntryId()).isNull();
    }
}
