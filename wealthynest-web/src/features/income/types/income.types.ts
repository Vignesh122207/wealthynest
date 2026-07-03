export type IncomePaymentMode = "CASH" | "BANK_ACCOUNT";

export interface IncomeEntry {
  id:           string;
  accountId?:   string;
  source:       string;
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
  source:       string;
  paymentMode?: IncomePaymentMode;
  amount:       number;
  description?: string;
  incomeDate:   string;
  periodMonth:  number;
  periodYear:   number;
}
