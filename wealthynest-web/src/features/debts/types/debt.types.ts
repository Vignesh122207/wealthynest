export type DebtType   = "LENT" | "BORROWED";
export type DebtStatus = "ACTIVE" | "SETTLED" | "PARTIAL";

export interface DebtPayment {
  id:     string;
  amount: number;
  note?:  string;
  paidAt: string;
}

export interface DebtRecord {
  id:              string;
  type:            DebtType;
  accountId?:      string;
  accountName?:    string;
  contactName:     string;
  contactPhone?:   string;
  amount:          number;
  description?:    string;
  debtDate?:       string;
  dueDate?:        string;
  status:          DebtStatus;
  amountSettled:   number;
  amountRemaining: number;
  payments:        DebtPayment[];
  createdAt:       string;
}
