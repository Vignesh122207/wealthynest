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
  budgeted:      number;
  spent:         number;
  percentUsed:   number;
  overBudget:    boolean;
}
