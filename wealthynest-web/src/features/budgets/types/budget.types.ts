export type BudgetType = "MONTHLY" | "YEARLY";

export interface Budget {
  id:             string;
  categoryId:     string;
  categoryName?:  string;
  categoryIcon?:  string;
  categoryColor?: string;
  amount:         number;
  spent:          number;
  remaining:      number;
  percentUsed:    number;
  overBudget:     boolean;
  periodMonth:    number;
  periodYear:     number;
  alertThreshold: number;
  alertTriggered: boolean;
  budgetType:     BudgetType;
}

export interface CreateBudgetPayload {
  categoryId:      string;
  amount:          number;
  alertThreshold?: number;
  budgetType:      BudgetType;
}

export interface UpdateBudgetPayload {
  amount:          number;
  alertThreshold?: number;
  categoryId?:     string;
}
