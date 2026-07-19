package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.NseCorporateAction;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NseCorporateActionRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private NseCorporateActionRepository nseCorporateActionRepository;

    private NseCorporateAction persistAction(String symbol, String type, LocalDate exDate, BigDecimal dividend) {
        NseCorporateAction a = NseCorporateAction.builder().symbol(symbol).actionType(type)
                .exDate(exDate).dividendPerShare(dividend).build();
        entityManager.persist(a);
        return a;
    }

    @Test
    @DisplayName("findBySymbolAndExDateAfterOrderByExDateDesc excludes actions on/before the given date, newest-first")
    void findAfterDateExcludesOlderOrEqual() {
        persistAction("INFY", "DIVIDEND", LocalDate.of(2026, 1, 1), new BigDecimal("5"));
        NseCorporateAction after = persistAction("INFY", "DIVIDEND", LocalDate.of(2026, 6, 1), new BigDecimal("8"));
        entityManager.flush();

        List<NseCorporateAction> result = nseCorporateActionRepository
                .findBySymbolAndExDateAfterOrderByExDateDesc("INFY", LocalDate.of(2026, 3, 1));

        assertThat(result).extracting(NseCorporateAction::getId).containsExactly(after.getId());
    }

    @Test
    @DisplayName("existsBySymbolAndActionTypeAndExDate detects an exact duplicate before re-inserting")
    void existsDetectsExactDuplicate() {
        persistAction("TCS", "DIVIDEND", LocalDate.of(2026, 6, 1), new BigDecimal("10"));
        entityManager.flush();

        assertThat(nseCorporateActionRepository.existsBySymbolAndActionTypeAndExDate(
                "TCS", "DIVIDEND", LocalDate.of(2026, 6, 1))).isTrue();
        assertThat(nseCorporateActionRepository.existsBySymbolAndActionTypeAndExDate(
                "TCS", "BONUS", LocalDate.of(2026, 6, 1))).isFalse();
    }

    @Test
    @DisplayName("findDividendsBySymbolsAndYear scopes to the calendar year and excludes non-DIVIDEND action types")
    void findDividendsScopesToYearAndType() {
        NseCorporateAction inYear = persistAction("INFY", "DIVIDEND", LocalDate.of(2026, 6, 1), new BigDecimal("5"));
        persistAction("INFY", "DIVIDEND", LocalDate.of(2025, 12, 31), new BigDecimal("999")); // prior year
        persistAction("INFY", "BONUS", LocalDate.of(2026, 3, 1), null); // wrong action type
        entityManager.flush();

        List<NseCorporateAction> result = nseCorporateActionRepository.findDividendsBySymbolsAndYear(List.of("INFY"), 2026);

        assertThat(result).extracting(NseCorporateAction::getId).containsExactly(inYear.getId());
    }
}
