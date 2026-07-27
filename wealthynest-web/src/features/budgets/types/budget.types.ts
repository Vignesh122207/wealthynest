export type BudgetType = "MONTHLY" | "YEARLY";

export interface Budget {
  id:             string;
  categoryId:     string;
  categoryName?:  string;
  categoryIcon?:  string;
  categoryColor?: string;
  amount:         number;
  spent:          number;
  annualSpent:    number;
  remaining:      number;
  percentUsed:    number;
  overBudget:     boolean;
  periodMonth:    number;
  periodYear:     number;
  alertThreshold: number;
  alertTriggered: boolean;
  budgetType:     BudgetType;
  shared:         boolean;
  rollover:       boolean;
  /** Unspent amount carried in from last month only (never compounds) — 0 when rollover is off,
   *  the budget is YEARLY, or the budget didn't exist for the whole of last month. Already
   *  factored into remaining/percentUsed/overBudget/alertTriggered. */
  rolloverAmount: number;
}

export interface CreateBudgetPayload {
  categoryId:      string;
  amount:          number;
  alertThreshold?: number;
  budgetType:      BudgetType;
  rollover?:       boolean;
}

export interface UpdateBudgetPayload {
  amount:          number;
  alertThreshold?: number;
  categoryId?:     string;
  rollover?:       boolean;
}
