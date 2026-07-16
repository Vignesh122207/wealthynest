package com.wealthynest.domain.expensesplit.service;

import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expensesplit.dto.request.SplitParticipantRequest;
import com.wealthynest.domain.expensesplit.dto.response.MySplitsResponse;
import java.util.List;
import java.util.UUID;

public interface ExpenseSplitService {
    void createSplits(Expense expense, List<SplitParticipantRequest> splitWith);
    MySplitsResponse getMySplits(UUID userId);
    void settleSplit(UUID splitId, UUID userId);
    void settleWithCounterpart(UUID userId, UUID counterpartId);
}
