export type AssetType =
  | "BANK_ACCOUNT" | "CASH" | "STOCK" | "MUTUAL_FUND" | "BOND" | "GOLD"
  | "REAL_ESTATE" | "VEHICLE" | "GOLD_JEWELRY" | "BUSINESS_EQUITY" | "EPF_PPF" | "RECEIVABLES" | "OTHER";

export interface Asset {
  id:             string;
  name:           string;
  assetType:      AssetType;
  currentValue:   number;
  currency:       string;
  institution?:   string;
  accountNumber?: string;
  notes?:         string;
  active:         boolean;
  asOfDate:       string;
  createdAt:      string;
  updatedAt:      string;
}

export interface CreateAssetPayload {
  name:           string;
  assetType:      AssetType;
  currentValue:   number;
  institution?:   string;
  accountNumber?: string;
  notes?:         string;
  asOfDate?:      string;
}
