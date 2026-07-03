package com.wealthynest.domain.asset.entity;
public enum AssetType {
    // Legacy values (kept for backward compat, not offered as new options)
    BANK_ACCOUNT, CASH, STOCK, MUTUAL_FUND, BOND, GOLD,
    // Active physical/non-investment asset types
    REAL_ESTATE, VEHICLE, GOLD_JEWELRY, BUSINESS_EQUITY, EPF_PPF, RECEIVABLES, OTHER
}
