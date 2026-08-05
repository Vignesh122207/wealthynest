export interface AssetBreakdown {
  assetType:  string;
  totalValue: number;
  count:      number;
}

export interface LiabilityBreakdown {
  liabilityType:    string;
  totalOutstanding: number;
  count:            number;
}

export interface PurposeItem {
  sourceType: "ACCOUNT" | "INVESTMENT";
  name:       string;
  amount:     number;
}

export interface PurposeBreakdown {
  purpose:    string;
  label:      string;
  totalValue: number;
  items:      PurposeItem[];
}

export interface NetWorthSummary {
  totalNetWorth:    number;
  totalAssets:      number;
  totalLiabilities: number;
  liquidBalance:    number;
  investmentValue:  number;
  manualAssetsValue:number;
  assetBreakdown:      AssetBreakdown[];
  liabilityBreakdown:  LiabilityBreakdown[];
  /** Re-slice of the same accounts/investments already counted above, grouped by purpose —
   * never additive, purely a display breakdown. */
  purposeBreakdown:    PurposeBreakdown[];
}

export interface NetWorthHistoryPoint {
  year:     number;
  month:    number;
  label:    string;
  netWorth: number;
}
