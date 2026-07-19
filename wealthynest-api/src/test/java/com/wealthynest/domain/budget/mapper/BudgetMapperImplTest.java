package com.wealthynest.domain.budget.mapper;

import com.wealthynest.domain.budget.dto.request.CreateBudgetRequest;
import com.wealthynest.domain.budget.dto.response.BudgetResponse;
import com.wealthynest.domain.budget.entity.Budget;
import com.wealthynest.domain.budget.entity.BudgetType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class BudgetMapperImplTest {

    private final BudgetMapper mapper = new BudgetMapperImpl();

    private CreateBudgetRequest request(BigDecimal alertThreshold, BudgetType budgetType) {
        CreateBudgetRequest req = new CreateBudgetRequest();
        ReflectionTestUtils.setField(req, "categoryId", UUID.randomUUID());
        ReflectionTestUtils.setField(req, "amount", new BigDecimal("5000"));
        ReflectionTestUtils.setField(req, "periodMonth", 6);
        ReflectionTestUtils.setField(req, "periodYear", 2025);
        ReflectionTestUtils.setField(req, "alertThreshold", alertThreshold);
        ReflectionTestUtils.setField(req, "budgetType", budgetType);
        return req;
    }

    @Test
    @DisplayName("toEntity returns null for a null request")
    void toEntityNullInputReturnsNull() {
        assertThat(mapper.toEntity(null)).isNull();
    }

    @Test
    @DisplayName("toEntity defaults alertThreshold to 80.00 and budgetType to MONTHLY when omitted")
    void toEntityAppliesDefaultsWhenFieldsOmitted() {
        Budget budget = mapper.toEntity(request(null, null));

        assertThat(budget.getAlertThreshold()).isEqualByComparingTo("80.00");
        assertThat(budget.getBudgetType()).isEqualTo(BudgetType.MONTHLY);
        assertThat(budget.getPeriodMonth()).isEqualTo(6);
        assertThat(budget.getPeriodYear()).isEqualTo(2025);
    }

    @Test
    @DisplayName("toEntity uses the request's explicit alertThreshold and budgetType when provided")
    void toEntityUsesExplicitValuesWhenProvided() {
        Budget budget = mapper.toEntity(request(new BigDecimal("90"), BudgetType.YEARLY));

        assertThat(budget.getAlertThreshold()).isEqualByComparingTo("90");
        assertThat(budget.getBudgetType()).isEqualTo(BudgetType.YEARLY);
    }

    @Test
    @DisplayName("toEntity leaves periodMonth/periodYear at their zero default when the request omits them")
    void toEntityLeavesNullPeriodFieldsUnset() {
        CreateBudgetRequest req = new CreateBudgetRequest();
        ReflectionTestUtils.setField(req, "categoryId", UUID.randomUUID());
        ReflectionTestUtils.setField(req, "amount", new BigDecimal("1000"));

        Budget budget = mapper.toEntity(req);

        assertThat(budget.getPeriodMonth()).isEqualTo(0);
        assertThat(budget.getPeriodYear()).isEqualTo(0);
    }

    @Test
    @DisplayName("toResponse returns null for a null budget")
    void toResponseNullInputReturnsNull() {
        assertThat(mapper.toResponse(null)).isNull();
    }

    @Test
    @DisplayName("toResponse maps shared=true when the budget has a familyId")
    void toResponseSharedTrueWithFamilyId() {
        Budget budget = Budget.builder()
                .categoryId(UUID.randomUUID()).amount(new BigDecimal("5000"))
                .familyId(UUID.randomUUID()).alertThreshold(new BigDecimal("80")).budgetType(BudgetType.MONTHLY)
                .build();

        BudgetResponse response = mapper.toResponse(budget);

        assertThat(response.isShared()).isTrue();
        assertThat(response.getAmount()).isEqualByComparingTo("5000");
    }

    @Test
    @DisplayName("toResponse maps shared=false when the budget has no familyId (personal budget)")
    void toResponseSharedFalseWithoutFamilyId() {
        Budget budget = Budget.builder()
                .categoryId(UUID.randomUUID()).amount(new BigDecimal("5000"))
                .familyId(null).alertThreshold(new BigDecimal("80")).budgetType(BudgetType.MONTHLY)
                .build();

        BudgetResponse response = mapper.toResponse(budget);

        assertThat(response.isShared()).isFalse();
    }
}
