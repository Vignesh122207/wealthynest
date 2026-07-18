package com.wealthynest.domain.expensesplit.repository;

import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expensesplit.entity.ExpenseSplit;
import com.wealthynest.domain.expensesplit.entity.SplitStatus;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ExpenseSplitRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private ExpenseSplitRepository expenseSplitRepository;

    private UUID familyId;
    private UUID payerId;
    private UUID participantId;
    private UUID expenseId;

    @BeforeEach
    void seedUsersAndExpense() {
        User payer = User.builder().fullName("Bea").email("bea-" + UUID.randomUUID() + "@x.com").passwordHash("hash").build();
        entityManager.persist(payer);
        payerId = payer.getId();

        User participant = User.builder().fullName("Carl").email("carl-" + UUID.randomUUID() + "@x.com").passwordHash("hash").build();
        entityManager.persist(participant);
        participantId = participant.getId();

        Category category = Category.builder().userId(payerId).name("Dining").type(CategoryType.EXPENSE).build();
        entityManager.persist(category);

        Expense expense = Expense.builder().userId(payerId).categoryId(category.getId())
                .amount(new BigDecimal("100")).expenseDate(LocalDate.now()).build();
        entityManager.persist(expense);
        expenseId = expense.getId();

        familyId = UUID.randomUUID();
        entityManager.flush();
    }

    private ExpenseSplit persistSplit(UUID payer, UUID participant, BigDecimal amount, SplitStatus status) {
        ExpenseSplit s = ExpenseSplit.builder().expenseId(expenseId).familyId(familyId)
                .payerUserId(payer).participantUserId(participant).shareAmount(amount).status(status).build();
        entityManager.persist(s);
        return s;
    }

    @Test
    @DisplayName("findByParticipantUserIdAndStatus and findByPayerUserIdAndStatus scope by role and status independently")
    void findByRoleAndStatusScopedIndependently() {
        ExpenseSplit owedToMe = persistSplit(participantId, payerId, new BigDecimal("50"), SplitStatus.PENDING); // I'm the payer here
        ExpenseSplit iOwe = persistSplit(payerId, participantId, new BigDecimal("30"), SplitStatus.PENDING); // I'm the participant here
        persistSplit(payerId, participantId, new BigDecimal("999"), SplitStatus.SETTLED); // wrong status — excluded
        entityManager.flush();

        List<ExpenseSplit> iOweList = expenseSplitRepository.findByParticipantUserIdAndStatus(participantId, SplitStatus.PENDING);
        List<ExpenseSplit> owedToMeList = expenseSplitRepository.findByPayerUserIdAndStatus(payerId, SplitStatus.PENDING);

        assertThat(iOweList).extracting(ExpenseSplit::getId).containsExactly(iOwe.getId());
        assertThat(owedToMeList).extracting(ExpenseSplit::getId).containsExactly(iOwe.getId());
    }

    @Test
    @DisplayName("findByExpenseId and sumSharesByExpenseId aggregate every split on that expense")
    void findAndSumByExpenseId() {
        persistSplit(payerId, participantId, new BigDecimal("40"), SplitStatus.PENDING);
        User thirdUser = User.builder().fullName("Dee").email("dee-" + UUID.randomUUID() + "@x.com").passwordHash("hash").build();
        entityManager.persist(thirdUser);
        persistSplit(payerId, thirdUser.getId(), new BigDecimal("60"), SplitStatus.PENDING);
        entityManager.flush();

        assertThat(expenseSplitRepository.findByExpenseId(expenseId)).hasSize(2);
        assertThat(expenseSplitRepository.sumSharesByExpenseId(expenseId)).isEqualByComparingTo("100");
    }

    @Nested
    @DisplayName("settleBetween — bidirectional bulk settlement")
    class SettleBetweenTests {

        @Test
        @DisplayName("settles a pending split regardless of which of the two users is payer vs participant")
        void settlesRegardlessOfDirection() {
            ExpenseSplit forward = persistSplit(payerId, participantId, new BigDecimal("40"), SplitStatus.PENDING);
            ExpenseSplit reverse = persistSplit(participantId, payerId, new BigDecimal("20"), SplitStatus.PENDING);
            entityManager.flush();
            entityManager.clear();

            int updated = expenseSplitRepository.settleBetween(payerId, participantId, Instant.now());
            entityManager.clear();

            assertThat(updated).isEqualTo(2);
            assertThat(entityManager.find(ExpenseSplit.class, forward.getId()).getStatus()).isEqualTo(SplitStatus.SETTLED);
            assertThat(entityManager.find(ExpenseSplit.class, reverse.getId()).getStatus()).isEqualTo(SplitStatus.SETTLED);
        }

        @Test
        @DisplayName("does not touch a pending split against an unrelated third user")
        void doesNotTouchUnrelatedThirdParty() {
            User thirdUser = User.builder().fullName("Eve").email("eve-" + UUID.randomUUID() + "@x.com").passwordHash("hash").build();
            entityManager.persist(thirdUser);
            ExpenseSplit unrelated = persistSplit(payerId, thirdUser.getId(), new BigDecimal("15"), SplitStatus.PENDING);
            entityManager.flush();
            entityManager.clear();

            expenseSplitRepository.settleBetween(payerId, participantId, Instant.now());
            entityManager.clear();

            assertThat(entityManager.find(ExpenseSplit.class, unrelated.getId()).getStatus()).isEqualTo(SplitStatus.PENDING);
        }

        @Test
        @DisplayName("does not re-settle an already-SETTLED split")
        void doesNotReSettleAlreadySettled() {
            ExpenseSplit alreadySettled = persistSplit(payerId, participantId, new BigDecimal("10"), SplitStatus.SETTLED);
            entityManager.flush();
            entityManager.clear();

            int updated = expenseSplitRepository.settleBetween(payerId, participantId, Instant.now());

            assertThat(updated).isZero();
        }
    }
}
