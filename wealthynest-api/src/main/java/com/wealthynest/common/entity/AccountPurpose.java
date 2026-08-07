package com.wealthynest.common.entity;

/** Optional "what is this money for" tag — assignable to a Bank Account or an Investment (never
 * Cash Wallet, Credit Card, or Loan). Purely descriptive: never affects balance/net-worth math,
 * only how it's grouped for display. CUSTOM pairs with a free-text label on the owning row. */
public enum AccountPurpose {
    EMERGENCY_FUND, RETIREMENT, EDUCATION, HOUSE_PURCHASE, VEHICLE_PURCHASE,
    VACATION, CHILD_FUTURE, TAX_SAVINGS, INVESTMENT, GENERAL_SAVINGS,
    WEDDING, MEDICAL, DEBT_PAYOFF, HOME_RENOVATION, DAILY_SPENDING, CUSTOM
}
