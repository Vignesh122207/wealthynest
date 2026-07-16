export type AccountType = "CASH_WALLET" | "BANK_ACCOUNT" | "EMERGENCY_FUND" | "CREDIT_CARD" | "LOAN" | "INVESTMENT";

export type LoanType =
  | "HOME_LOAN" | "CAR_LOAN" | "PERSONAL_LOAN"
  | "EDUCATION_LOAN" | "GOLD_LOAN" | "BUSINESS_LOAN" | "OTHER";

export interface AccountTransactionItem {
  id:          string;
  type:        "INCOME" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT" | "DEBT_OUT" | "DEBT_IN" | "ADJUSTMENT";
  label:       string;
  source?:     "MANUAL" | "INVESTMENT";
  amount:      number;
  date:        string;
  description?: string;
  categoryIcon?:  string | null;
  categoryColor?: string | null;
}

export interface WalletAccount {
  id:                 string;
  accountType:        AccountType;
  name:               string;
  bankName?:          string;
  accountNumber?:     string;
  openingBalance:     number;
  currentBalance:     number;
  lowBalanceThreshold?: number;
  belowLowBalanceThreshold?: boolean;
  totalMoneyIn:       number;
  totalMoneyOut:      number;
  recentTransactions: AccountTransactionItem[];
  createdAt:          string;
  archived?:          boolean;
  primary?:           boolean;
  // Credit card fields
  creditLimit?:       number;
  availableCredit?:   number;
  statementDay?:      number;
  paymentDueDay?:     number;
  apr?:               number;
  nextStatementDate?: string;
  nextDueDate?:       string;
  // Loan fields (currentBalance = outstanding, apr = interest rate, bankName = lender)
  loanType?:           LoanType;
  principalAmount?:    number;
  emiAmount?:          number;
  emiDay?:             number;
  autopayAccountId?:   string;
  autopayAccountName?: string;
  loanEndDate?:        string;
  nextEmiDate?:        string;
}

export interface CreateAccountPayload {
  accountType:    AccountType;
  name:           string;
  bankName?:      string;
  accountNumber?: string;
  openingBalance: number;
  lowBalanceThreshold?: number;
  // Credit card
  creditLimit?:   number;
  statementDay?:  number;
  paymentDueDay?: number;
  apr?:           number;
  // Loan (openingBalance = current outstanding, bankName = lender, apr = interest rate)
  loanType?:         LoanType;
  principalAmount?:  number;
  emiAmount?:        number;
  emiDay?:           number;
  autopayAccountId?: string;
  loanEndDate?:      string;
}

export interface LoanPaymentResult {
  interestPaid:   number;
  principalPaid:  number;
  newOutstanding: number;
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
  // Not "isAdjustment"/"isDebt" — Jackson strips the "is" prefix from Lombok's isXxx() getters
  // when deriving the JSON key, so the wire format is "adjustment"/"debt" regardless of how the
  // Java field is spelled. Matching that here avoids a field that's silently always undefined.
  adjustment:      boolean;
  debt:            boolean;
  debtContactName?: string;
  debtLabel?:      "LENT" | "BORROWED" | "REPAID";
  transferDate:    string;
  createdAt:       string;
}
