package com.wealthynest.domain.account.entity;

public enum AccountType {
    CASH_WALLET, BANK_ACCOUNT, CREDIT_CARD, LOAN;

    /** Liability accounts owe money: balance = outstanding, payments in reduce it. */
    public boolean isLiability() {
        return this == CREDIT_CARD || this == LOAN;
    }
}
