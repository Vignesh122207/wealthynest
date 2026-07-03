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

export interface NetWorthSummary {
  totalNetWorth:    number;
  totalAssets:      number;
  totalLiabilities: number;
  liquidBalance:    number;
  emergencyFund:    number;
  investmentValue:  number;
  manualAssetsValue:number;
  assetBreakdown:      AssetBreakdown[];
  liabilityBreakdown:  LiabilityBreakdown[];
}

export interface NetWorthHistoryPoint {
  year:     number;
  month:    number;
  label:    string;
  netWorth: number;
}
