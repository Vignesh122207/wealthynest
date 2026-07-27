import type {BudgetType} from "@/features/budgets/types/budget.types";

export interface DashboardData {
  totalNetWorth:        number;
  monthlyExpenses:      number;
  monthlyIncome:        number;
  savingsRate:          number;
  totalInvested:        number;
  totalInvestmentValue: number;
  totalDividendIncome:  number;
  categoryBreakdown:    CategorySpending[];
  budgetSummaries:      BudgetSummary[];
  monthlyTrend:         MonthlyTrend[];
}

export interface MonthlyTrend {
  year:     number;
  month:    number;
  label:    string;
  income:   number;
  expenses: number;
  saved:    number;
}

export interface CategorySpending {
  categoryId:    string;
  categoryName:  string;
  categoryColor: string;
  categoryIcon:  string;
  amount:        number;
  percentage:    number;
}

export interface BudgetSummary {
  categoryId:    string;
  categoryName:  string;
  categoryColor?: string;
  categoryIcon?:  string;
  // A category can have both a MONTHLY and a YEARLY budget at once — consumers that key/dedupe
  // off this response must include budgetType, not just categoryId, or two distinct breached
  // budgets for the same category collide into one indistinguishable notification.
  budgetType:    BudgetType;
  budgeted:      number;
  spent:         number;
  percentUsed:   number;
  overBudget:    boolean;
}
