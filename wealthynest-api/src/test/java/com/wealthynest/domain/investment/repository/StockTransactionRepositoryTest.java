package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.Investment;
import com.wealthynest.domain.investment.entity.InvestmentType;
import com.wealthynest.domain.investment.entity.StockTransaction;
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

class StockTransactionRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private StockTransactionRepository stockTransactionRepository;

    private UUID userId;
    private UUID investmentId;

    @BeforeEach
    void seedUserAssetAndInvestment() {
        User user = User.builder().fullName("Tara").email("tara-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();

        Investment investment = Investment.builder().userId(userId)
                .investmentType(InvestmentType.STOCK).symbol("INFY")
                .investedAmount(new BigDecimal("1000")).currentValue(new BigDecimal("1200")).build();
        entityManager.persist(investment);
        investmentId = investment.getId();

        entityManager.flush();
    }

    private StockTransaction persistTxn(String type, BigDecimal quantity, BigDecimal price, LocalDate date) {
        StockTransaction t = StockTransaction.builder().investmentId(investmentId).transactionType(type)
                .quantity(quantity).pricePerShare(price).transactionDate(date).build();
        entityManager.persist(t);
        return t;
    }

    @Test
    @DisplayName("findByInvestmentIdOrderByTransactionDateAsc returns oldest-first")
    void findByInvestmentOrdersByDateAsc() {
        StockTransaction later = persistTxn("BUY", new BigDecimal("5"), new BigDecimal("100"), LocalDate.of(2026, 6, 10));
        StockTransaction earlier = persistTxn("BUY", new BigDecimal("5"), new BigDecimal("90"), LocalDate.of(2026, 6, 1));
        entityManager.flush();

        List<StockTransaction> result = stockTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId);

        assertThat(result).extracting(StockTransaction::getId).containsExactly(earlier.getId(), later.getId());
    }

    @Test
    @DisplayName("findByInvestmentIdInOrderByTransactionDateAsc batches across multiple investments")
    void findByInvestmentIdInBatches() {
        persistTxn("BUY", new BigDecimal("5"), new BigDecimal("100"), LocalDate.of(2026, 6, 1));
        entityManager.flush();

        List<StockTransaction> result = stockTransactionRepository.findByInvestmentIdInOrderByTransactionDateAsc(List.of(investmentId));

        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("sumNetQuantityByInvestmentId nets BUY minus SELL quantities")
    void sumNetQuantitySubtractsSells() {
        persistTxn("BUY", new BigDecimal("10"), new BigDecimal("100"), LocalDate.of(2026, 6, 1));
        persistTxn("SELL", new BigDecimal("3"), new BigDecimal("110"), LocalDate.of(2026, 6, 10));
        entityManager.flush();

        BigDecimal net = stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId);

        assertThat(net).isEqualByComparingTo("7");
    }

    @Test
    @DisplayName("sumBuyAmountByInvestmentId sums only BUY rows' quantity * price, excluding SELL")
    void sumBuyAmountExcludesSells() {
        persistTxn("BUY", new BigDecimal("10"), new BigDecimal("100"), LocalDate.of(2026, 6, 1)); // 1000
        persistTxn("SELL", new BigDecimal("3"), new BigDecimal("110"), LocalDate.of(2026, 6, 10)); // excluded
        entityManager.flush();

        BigDecimal buyAmount = stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId);

        assertThat(buyAmount).isEqualByComparingTo("1000");
    }

    @Test
    @DisplayName("sumBuyQuantityByInvestmentId sums only BUY quantities, excluding SELL")
    void sumBuyQuantityExcludesSells() {
        persistTxn("BUY", new BigDecimal("10"), new BigDecimal("100"), LocalDate.of(2026, 6, 1));
        persistTxn("SELL", new BigDecimal("3"), new BigDecimal("110"), LocalDate.of(2026, 6, 10));
        entityManager.flush();

        BigDecimal buyQty = stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId);

        assertThat(buyQty).isEqualByComparingTo("10");
    }

    @Test
    @DisplayName("countByInvestmentId counts every transaction regardless of type")
    void countByInvestmentIdCountsAll() {
        persistTxn("BUY", new BigDecimal("10"), new BigDecimal("100"), LocalDate.of(2026, 6, 1));
        persistTxn("SELL", new BigDecimal("3"), new BigDecimal("110"), LocalDate.of(2026, 6, 10));
        entityManager.flush();

        assertThat(stockTransactionRepository.countByInvestmentId(investmentId)).isEqualTo(2);
    }
}
