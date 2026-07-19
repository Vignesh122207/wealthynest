export type IncomePaymentMode = "CASH" | "BANK_ACCOUNT";

export type IncomeSource =
  | "SALARY" | "FREELANCE" | "BUSINESS" | "RENTAL"
  | "BONUS"  | "INTEREST"  | "DIVIDEND" | "OTHER";

export interface IncomeEntry {
  id:           string;
  accountId?:   string;
  source:       IncomeSource;
  paymentMode:  IncomePaymentMode;
  amount:       number;
  description?: string;
  incomeDate:   string;
  periodMonth:  number;
  periodYear:   number;
  debt:         boolean;
  createdAt:    string;
}

export interface CreateIncomePayload {
  accountId?:   string;
  source:       IncomeSource;
  paymentMode?: IncomePaymentMode;
  amount:       number;
  description?: string;
  incomeDate:   string;
  periodMonth:  number;
  periodYear:   number;
}
