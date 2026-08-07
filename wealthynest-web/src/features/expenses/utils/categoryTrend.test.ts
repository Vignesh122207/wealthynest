import {describe, it, expect} from "vitest";
import {buildCategoryTrend} from "./categoryTrend";
import type {Expense} from "../types/expense.types";

const today = new Date(2026, 7, 15); // Aug 15, 2026

function expenseOf(categoryId: string, expenseDate: string, amount: number): Expense {
  return {
    id: `${categoryId}-${expenseDate}-${amount}`, userId: "u1", categoryId, amount, currency: "INR",
    expenseDate, recurring: false, debt: false, createdAt: `${expenseDate}T00:00:00Z`,
  };
}

describe("buildCategoryTrend", () => {
  it("returns one point per month in the window, oldest first", () => {
    const points = buildCategoryTrend([], "cat1", 3, today);
    expect(points.map(p => p.label)).toEqual(["Jun 2026", "Jul 2026", "Aug 2026"]);
  });

  it("returns zero totals for months with no matching expenses", () => {
    const points = buildCategoryTrend([], "cat1", 3, today);
    expect(points.every(p => p.total === 0)).toBe(true);
  });

  it("sums same-month expenses for the target category", () => {
    const expenses = [
      expenseOf("cat1", "2026-08-01", 100),
      expenseOf("cat1", "2026-08-10", 50),
    ];
    const points = buildCategoryTrend(expenses, "cat1", 3, today);
    expect(points.find(p => p.label === "Aug 2026")?.total).toBe(150);
  });

  it("excludes expenses from a different category", () => {
    const expenses = [expenseOf("other-cat", "2026-08-01", 500)];
    const points = buildCategoryTrend(expenses, "cat1", 3, today);
    expect(points.every(p => p.total === 0)).toBe(true);
  });

  it("excludes expenses outside the requested month window", () => {
    // 6 months back from Aug 2026 is Feb 2026 — outside a 3-month window (Jun-Aug).
    const expenses = [expenseOf("cat1", "2026-02-15", 999)];
    const points = buildCategoryTrend(expenses, "cat1", 3, today);
    expect(points.every(p => p.total === 0)).toBe(true);
  });

  it("places each month's total under the correct label", () => {
    const expenses = [
      expenseOf("cat1", "2026-06-05", 10),
      expenseOf("cat1", "2026-07-05", 20),
      expenseOf("cat1", "2026-08-05", 30),
    ];
    const points = buildCategoryTrend(expenses, "cat1", 3, today);
    expect(points).toEqual([
      { label: "Jun 2026", total: 10 },
      { label: "Jul 2026", total: 20 },
      { label: "Aug 2026", total: 30 },
    ]);
  });
});
