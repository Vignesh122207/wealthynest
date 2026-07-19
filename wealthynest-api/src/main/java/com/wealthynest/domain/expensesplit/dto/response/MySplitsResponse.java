package com.wealthynest.domain.expensesplit.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.util.List;

@Getter @Builder
public class MySplitsResponse {
    private List<SplitBalanceResponse>  balances;
    private List<ExpenseSplitResponse>  pending;
}
