package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.Investment;
import com.wealthynest.domain.investment.entity.InvestmentType;
import com.wealthynest.domain.investment.entity.SipTransaction;
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

class SipTransactionRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private SipTransactionRepository sipTransactionRepository;

    private UUID investmentId;

    @BeforeEach
    void seedUserAssetAndInvestment() {
        User user = User.builder().fullName("Uma").email("uma-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);

        Investment investment = Investment.builder().userId(user.getId())
                .investmentType(InvestmentType.MUTUAL_FUND).schemeCode("SC001")
                .investedAmount(new BigDecimal("1000")).currentValue(new BigDecimal("1100")).build();
        entityManager.persist(investment);
        investmentId = investment.getId();

        entityManager.flush();
    }

    private SipTransaction persistSip(String type, BigDecimal amount, BigDecimal units, LocalDate date) {
        SipTransaction s = SipTransaction.builder().investmentId(investmentId).transactionType(type)
                .amount(amount).units(units).transactionDate(date).build();
        entityManager.persist(s);
        return s;
    }

    @Test
    @DisplayName("findByInvestmentIdOrderByTransactionDateAsc returns oldest-first")
    void findByInvestmentOrdersByDateAsc() {
        SipTransaction later = persistSip("BUY", new BigDecimal("5000"), new BigDecimal("50"), LocalDate.of(2026, 6, 10));
        SipTransaction earlier = persistSip("BUY", new BigDecimal("5000"), new BigDecimal("55"), LocalDate.of(2026, 6, 1));
        entityManager.flush();

        List<SipTransaction> result = sipTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId);

        assertThat(result).extracting(SipTransaction::getId).containsExactly(earlier.getId(), later.getId());
    }

    @Test
    @DisplayName("findByInvestmentIdInOrderByTransactionDateAsc batches across multiple investments")
    void findByInvestmentIdInBatches() {
        persistSip("BUY", new BigDecimal("5000"), new BigDecimal("50"), LocalDate.of(2026, 6, 1));
        entityManager.flush();

        List<SipTransaction> result = sipTransactionRepository.findByInvestmentIdInOrderByTransactionDateAsc(List.of(investmentId));

        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("sumBuyAmountByInvestmentId and sumUnitsByInvestmentId only count BUY rows")
    void sumsOnlyCountBuyRows() {
        persistSip("BUY", new BigDecimal("5000"), new BigDecimal("50"), LocalDate.of(2026, 6, 1));
        persistSip("SELL", new BigDecimal("2000"), new BigDecimal("18"), LocalDate.of(2026, 6, 15));
        entityManager.flush();

        assertThat(sipTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).isEqualByComparingTo("5000");
        assertThat(sipTransactionRepository.sumUnitsByInvestmentId(investmentId)).isEqualByComparingTo("50");
    }
}
