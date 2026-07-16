export interface Expense {
  id:             string;
  userId:         string;
  familyId?:      string;
  categoryId:     string;
  accountId?:     string;
  budgetId?:      string;
  categoryName?:  string;
  categoryIcon?:  string;
  categoryColor?: string;
  amount:         number;
  currency:       string;
  description?:   string;
  notes?:         string;
  expenseDate:    string;
  recurring:      boolean;
  debt:           boolean;
  recurrenceRule?:string;
  paymentMethod?: string;
  createdAt:      string;
}

export interface SplitParticipant {
  userId:      string;
  shareAmount: number;
}

export interface CreateExpensePayload {
  categoryId:      string;
  budgetId?:       string;
  accountId?:      string;
  amount:          number;
  description?:    string;
  notes?:          string;
  expenseDate:     string;
  recurring?:      boolean;
  recurrenceRule?: string;
  paymentMethod?:  string;
  splitWith?:      SplitParticipant[];
}

export interface ExpenseFilters {
  categoryId?:  string;
  startDate?:   string;
  endDate?:     string;
  search?:      string;
  accountIds?:  string[];
  minAmount?:   number;
  maxAmount?:   number;
  recurring?:   boolean;
  sortBy?:      "expenseDate" | "amount";
  sortDir?:     "asc" | "desc";
  includeDebt?: boolean;
  page?:        number;
  size?:        number;
}
