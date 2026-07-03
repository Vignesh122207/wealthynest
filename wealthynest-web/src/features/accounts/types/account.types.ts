export type AccountType = "CASH_WALLET" | "BANK_ACCOUNT" | "EMERGENCY_FUND" | "CREDIT_CARD";

export interface AccountTransactionItem {
  id:          string;
  type:        "INCOME" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT" | "DEBT_OUT" | "DEBT_IN" | "ADJUSTMENT";
  label:       string;
  source?:     "MANUAL" | "INVESTMENT";
  amount:      number;
  date:        string;
  description?: string;
}

export interface WalletAccount {
  id:                 string;
  accountType:        AccountType;
  name:               string;
  bankName?:          string;
  accountNumber?:     string;
  openingBalance:     number;
  currentBalance:     number;
  totalMoneyIn:       number;
  totalMoneyOut:      number;
  recentTransactions: AccountTransactionItem[];
  createdAt:          string;
  archived?:          boolean;
  // Credit card fields
  creditLimit?:       number;
  availableCredit?:   number;
  statementDay?:      number;
  paymentDueDay?:     number;
  apr?:               number;
  nextStatementDate?: string;
  nextDueDate?:       string;
}

export interface CreateAccountPayload {
  accountType:    AccountType;
  name:           string;
  bankName?:      string;
  accountNumber?: string;
  openingBalance: number;
  // Credit card
  creditLimit?:   number;
  statementDay?:  number;
  paymentDueDay?: number;
  apr?:           number;
}

export interface TransferPayload {
  fromAccountId: string;
  toAccountId:   string;
  amount:        number;
  description?:  string;
  transferDate:  string;
}

export interface AccountTransfer {
  id:              string;
  fromAccountId:   string;
  fromAccountName: string;
  toAccountId:     string;
  toAccountName:   string;
  amount:          number;
  description?:    string;
  transferDate:    string;
  createdAt:       string;
}
