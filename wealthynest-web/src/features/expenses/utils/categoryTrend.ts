import {format, startOfMonth, subMonths} from "date-fns";
import type {Expense} from "../types/expense.types";

export interface CategoryTrendPoint {
  /** e.g. "Mar 2026" */
  label: string;
  total: number;
}

/** Total spend on one category, per month, for the last `months` months (inclusive of the
 * current month) — powers the detail drawer's category trajectory chart. Always returns a
 * point for every month in the window, even ones with zero spend, so the chart's x-axis stays
 * evenly spaced rather than skipping quiet months. */
export function buildCategoryTrend(expenses: Expense[], categoryId: string, months: number, today: Date): CategoryTrendPoint[] {
  const windowStart = startOfMonth(subMonths(today, months - 1));
  const totalsByMonthKey = new Map<string, number>();

  for (const e of expenses) {
    if (e.categoryId !== categoryId) continue;
    const expenseDate = new Date(`${e.expenseDate}T00:00:00`);
    if (expenseDate < windowStart) continue;
    const key = format(expenseDate, "yyyy-MM");
    totalsByMonthKey.set(key, (totalsByMonthKey.get(key) ?? 0) + e.amount);
  }

  const points: CategoryTrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(today, i);
    const key = format(monthDate, "yyyy-MM");
    points.push({ label: format(monthDate, "MMM yyyy"), total: totalsByMonthKey.get(key) ?? 0 });
  }
  return points;
}
