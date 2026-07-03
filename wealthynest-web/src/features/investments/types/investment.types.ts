export type InvestmentType = 'STOCK' | 'MUTUAL_FUND' | 'BOND' | 'FD' | 'GOLD' | 'GOLD_ETF' | 'PPF' | 'NPS' | 'REIT' | 'OTHER';

export interface Investment {
  id:             string;
  assetId:        string;
  investmentType: InvestmentType;
  symbol?:        string;
  exchange?:      string;
  schemeCode?:    string;
  companyName?:   string;
  units?:         number;
  avgBuyPrice?:   number;
  currentPrice?:  number;
  livePrice?:     number;
  investedAmount: number;
  currentValue:   number;
  gainLoss:       number;
  gainLossPct:    number;
  sipAmount?:     number;
  sipDay?:        number;
  purchaseDate?:  string;
  couponRate?:    number;
  couponFrequency?: string;
  couponCreditDay?: number;
  maturityDate?:  string;
  bankName?:      string;
  compoundingFrequency?: string;
  quantityGrams?: number;
  goldKarat?:     number;
  maturityAmount?:   number;
  accruedInterest?:  number;
  linkedAccountId?:  string;
  debitAccountId?:   string;
  debitAccountName?: string;
  notes?:         string;
  active:         boolean;
  createdAt:      string;
  dayChange?:     number;
  dayChangePct?:  number;
  week52High?:    number;
  week52Low?:     number;
  priceLastUpdated?: string;
}

export interface CreateInvestmentPayload {
  investmentType:       InvestmentType;
  symbol?:              string;
  exchange?:            string;
  schemeCode?:          string;
  companyName?:         string;
  units?:               number;
  avgBuyPrice?:         number;
  currentPrice?:        number;
  investedAmount:       number;
  currentValue:         number;
  sipAmount?:           number;
  sipDay?:              number;
  purchaseDate?:        string;
  couponRate?:          number;
  couponFrequency?:     string;
  couponCreditDay?:     number;
  maturityDate?:        string;
  bankName?:            string;
  compoundingFrequency?: string;
  quantityGrams?:       number;
  goldKarat?:           number;
  linkedAccountId?:     string;
  debitAccountId?:      string;
  notes?:               string;
}

export interface InvestmentSearchResult {
  symbol?:    string;
  name:       string;
  exchange?:  string;
  type:       'STOCK' | 'MF';
  schemeCode?: string;
}

export interface SipTransaction {
  id:              number;
  transactionDate: string;
  amount:          number;
  units?:          number;
  nav?:            number;
  transactionType: 'BUY' | 'REDEEM';
  notes?:          string;
}

export interface CreateSipPayload {
  transactionDate: string;
  amount:          number;
  units?:          number;
  nav?:            number;
  transactionType?: string;
  notes?:          string;
}

export interface IncomeHistoryRecord {
  id:               string;
  incomeType:       "DIVIDEND" | "BOND_COUPON" | "FD_MATURITY";
  eventDate:        string;
  amount:           number;
  perShare?:        number;
  units?:           number;
  investmentId:     string;
  investmentName:   string;
  symbol?:          string;
  accountId?:       string;
  accountName?:     string;
  investmentActive: boolean;
  credited:         boolean; // true = credited to wallet; false = history display only
}

export interface IncomeHistorySummary {
  year:            number;
  dividendTotal:   number;
  bondCouponTotal: number;
  fdMaturityTotal: number;
  grandTotal:      number;
}

export interface IncomeHistory {
  summary: IncomeHistorySummary;
  records: IncomeHistoryRecord[];
}

export interface DividendSuggestion {
  investmentId:     string;
  symbol:           string;
  companyName?:     string;
  exDate:           string;
  dividendPerShare: number;
  sharesHeld:       number;
  suggestedIncome:  number;
  alreadyLogged:    boolean;
}
