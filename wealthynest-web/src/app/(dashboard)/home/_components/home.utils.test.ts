import {describe, expect, it} from "vitest";
import {buildSmartInsights, getAnomalyInsight, getCategoryDeltaInsights, getNetWorthBaseline, getPaceForecast, getYtdMonths, sumTrend} from "./home.utils";
import type {MonthlyTrend} from "@/features/dashboard/types/dashboard.types";
import type {NetWorthHistoryPoint} from "@/features/networth/types/networth.types";
import type {SmartInsight} from "./SmartAlerts";

function trend(month: number, income: number, expenses: number): MonthlyTrend {
  return { year: 2026, month, label: "", income, expenses, saved: income - expenses };
}

describe("getYtdMonths", () => {
  it("returns the current calendar month for the current year", () => {
    expect(getYtdMonths(2026, new Date(2026, 7, 15))).toBe(8); // August, 0-indexed month=7
  });

  it("returns 12 for a past year", () => {
    expect(getYtdMonths(2025, new Date(2026, 7, 15))).toBe(12);
  });
});

describe("sumTrend", () => {
  it("sums income/expenses across the first N entries only", () => {
    const trends = [trend(1, 1000, 400), trend(2, 2000, 600), trend(3, 3000, 900)];
    expect(sumTrend(trends, 2)).toEqual({ income: 3000, expenses: 1000 });
  });

  it("returns zeros for an empty trend array", () => {
    expect(sumTrend([], 6)).toEqual({ income: 0, expenses: 0 });
  });
});

describe("getNetWorthBaseline", () => {
  const jan: NetWorthHistoryPoint  = { year: 2026, month: 1, label: "Jan", netWorth: 100 };
  const mar: NetWorthHistoryPoint  = { year: 2026, month: 3, label: "Mar", netWorth: 150 };
  const prevDec: NetWorthHistoryPoint = { year: 2025, month: 12, label: "Dec", netWorth: 80 };

  it("prefers the January snapshot of the given year", () => {
    expect(getNetWorthBaseline([prevDec, jan, mar], 2026)).toBe(jan);
  });

  it("falls back to the earliest snapshot in that year when January is missing", () => {
    expect(getNetWorthBaseline([prevDec, mar], 2026)).toBe(mar);
  });

  it("falls back to the first history point overall when the year has no snapshots yet", () => {
    expect(getNetWorthBaseline([prevDec], 2026)).toBe(prevDec);
  });

  it("returns undefined for empty history", () => {
    expect(getNetWorthBaseline([], 2026)).toBeUndefined();
  });
});

describe("getPaceForecast", () => {
  it("returns null when there's no income and no expense data at all", () => {
    expect(getPaceForecast(undefined, undefined, 10, 31, [1000])).toBeNull();
  });

  it("returns null for a nonsensical day-of-month/days-in-month input", () => {
    expect(getPaceForecast(1000, 500, 0, 31, [])).toBeNull();
    expect(getPaceForecast(1000, 500, 10, 0, [])).toBeNull();
  });

  it("returns null before day 5 — too few days to extrapolate without amplifying a single lumpy transaction", () => {
    expect(getPaceForecast(150000, 5000, 3, 31, [10000])).toBeNull();
  });

  it("extrapolates expenses from the elapsed-day rate but takes income as already recorded", () => {
    // ₹1000 spent over 10 days → ₹3100 projected expenses over a 31-day month; income (₹1500) is
    // NOT scaled the same way, so net pace goes negative even though income exceeds MTD expenses —
    // see getPaceForecast's own comment for why income isn't extrapolated like expenses are.
    const result = getPaceForecast(1500, 1000, 10, 31, []);
    expect(result?.amount).toBeCloseTo(1500 - 3100, 0);
  });

  // Regression for the real production bug this fixes: a ₹1,22,770 salary credited by day 5 of a
  // 31-day month used to render as "on pace to save ₹7,61,171" (income re-multiplied by ~6.2x on
  // top of already being the full month's income). With income no longer extrapolated, the
  // projected amount is just what's actually there.
  it("doesn't inflate an already-complete month's income when it lands as a single early lump sum", () => {
    const result = getPaceForecast(122770, 0, 5, 31, []);
    expect(result?.amount).toBeCloseTo(122770, 0);
  });

  it("returns pctVsAvg null when there's no prior-month history", () => {
    const result = getPaceForecast(1500, 1000, 10, 31, []);
    expect(result?.pctVsAvg).toBeNull();
  });

  it("returns pctVsAvg null when the prior average is exactly zero", () => {
    const result = getPaceForecast(1500, 1000, 10, 31, [0, 0]);
    expect(result?.pctVsAvg).toBeNull();
  });

  it("computes pctVsAvg against the average of prior months", () => {
    // projected 3100 - 1550 = 1550, prior avg (1000+2000)/2=1500 → +50/1500 = 3.33%
    const result = getPaceForecast(3100, 500, 10, 31, [1000, 2000]);
    expect(result?.pctVsAvg).toBeCloseTo(3.33, 1);
  });

  it("computes a negative pctVsAvg when pacing below the prior average", () => {
    const result = getPaceForecast(1000, 900, 10, 31, [1000]);
    expect(result?.pctVsAvg).toBeLessThan(0);
  });

  it("hides pctVsAvg (but keeps the amount) when a lumpy expense blows the % past the sanity cap", () => {
    // A large EMI/annual-premium expense hitting early in the month, extrapolated over the rest of
    // it, against a modest prior average is still a real case this guards — mathematically
    // "correct" but a meaningless-looking swing once compared to a normal month.
    const result = getPaceForecast(0, 50000, 5, 31, [-4000]);
    expect(result?.amount).toBeCloseTo(-310000, -1);
    expect(result?.pctVsAvg).toBeNull();
  });

  it("still surfaces a large but plausible pctVsAvg under the sanity cap", () => {
    // 400% above average is a big swing but still a meaningful, real comparison — must not be
    // suppressed by the same guard that hides the truly nonsensical case above.
    const result = getPaceForecast(6200, 0, 10, 31, [1240]);
    expect(result?.pctVsAvg).not.toBeNull();
    expect(result?.pctVsAvg).toBeCloseTo(400, 0);
  });
});

describe("getCategoryDeltaInsights", () => {
  function cat(id: string, name: string, amount: number) {
    return { categoryId: id, categoryName: name, amount };
  }

  it("returns [] before day 7 of the current month — too little data to mean anything yet", () => {
    const current  = [cat("c1", "Groceries", 200)];
    const previous = [cat("c1", "Groceries", 4200)];
    const result = getCategoryDeltaInsights(current, previous, {
      isCurrentMonth: true, dayOfMonth: 3, daysInMonth: 30, avgMonthlySpend: 20000,
    });
    expect(result).toEqual([]);
  });

  it("pace-projects the current month's month-to-date amount before comparing", () => {
    // ₹1500 over 10 days → projected ₹4500 over a 30-day month; prior month was ₹4200 → +300
    const current  = [cat("c1", "Groceries", 1500)];
    const previous = [cat("c1", "Groceries", 4200)];
    const result = getCategoryDeltaInsights(current, previous, {
      isCurrentMonth: true, dayOfMonth: 10, daysInMonth: 30, avgMonthlySpend: 2000,
    });
    expect(result).toHaveLength(1);
    expect(result[0].delta).toBeCloseTo(300, 0);
    expect(result[0].projected).toBe(true);
  });

  it("does not project a past (already-closed) month — compares the raw completed totals", () => {
    const current  = [cat("c1", "Dining", 3000)];
    const previous = [cat("c1", "Dining", 4200)];
    const result = getCategoryDeltaInsights(current, previous, {
      isCurrentMonth: false, dayOfMonth: 3, daysInMonth: 30, avgMonthlySpend: 20000,
    });
    expect(result).toEqual([{ category: "Dining", delta: -1200, projected: false }]);
  });

  it("drops deltas under the 5%-of-average threshold (min ₹100)", () => {
    const current  = [cat("c1", "Coffee", 3050)];
    const previous = [cat("c1", "Coffee", 3000)];
    const result = getCategoryDeltaInsights(current, previous, {
      isCurrentMonth: false, dayOfMonth: 28, daysInMonth: 30, avgMonthlySpend: 20000,
    });
    expect(result).toEqual([]);
  });

  it("treats a category missing from the prior period as a delta from zero", () => {
    const current  = [cat("c1", "New Category", 2000)];
    const previous: ReturnType<typeof cat>[] = [];
    const result = getCategoryDeltaInsights(current, previous, {
      isCurrentMonth: false, dayOfMonth: 28, daysInMonth: 30, avgMonthlySpend: 20000,
    });
    expect(result).toEqual([{ category: "New Category", delta: 2000, projected: false }]);
  });

  it("sorts by absolute delta and caps at 3 results", () => {
    const current = [cat("a", "A", 5000), cat("b", "B", 1000), cat("c", "C", 3000), cat("d", "D", 10000)];
    const previous = [cat("a", "A", 4000), cat("b", "B", 4000), cat("c", "C", 1000), cat("d", "D", 4000)];
    // deltas: A +1000, B -3000, C +2000, D +6000
    const result = getCategoryDeltaInsights(current, previous, {
      isCurrentMonth: false, dayOfMonth: 28, daysInMonth: 30, avgMonthlySpend: 20000,
    });
    expect(result).toHaveLength(3);
    expect(result.map(r => r.category)).toEqual(["D", "B", "C"]);
  });

  // Regression: a single one-time purchase early in the month, in a category with little/no prior
  // spend, used to get multiplied by the same run-rate math as the income bug — a ₹50,000
  // electronics buy on day 7 of a 31-day month projected to "₹2,21,429 more than last month".
  it("drops a projected delta that's implausible against the category's own history", () => {
    const current  = [cat("c1", "Electronics", 50000)];
    const previous: ReturnType<typeof cat>[] = [];
    const result = getCategoryDeltaInsights(current, previous, {
      isCurrentMonth: true, dayOfMonth: 7, daysInMonth: 31, avgMonthlySpend: 20000,
    });
    expect(result).toEqual([]);
  });

  it("still surfaces a large but plausible projected delta under the sanity cap", () => {
    // Projected ₹4500 vs. a real ₹1200 prior month is a genuinely big, meaningful swing (275%
    // above this category's own history) — must not be suppressed by the same guard.
    const current  = [cat("c1", "Dining", 1500)];
    const previous = [cat("c1", "Dining", 1200)];
    const result = getCategoryDeltaInsights(current, previous, {
      isCurrentMonth: true, dayOfMonth: 10, daysInMonth: 30, avgMonthlySpend: 2000,
    });
    expect(result).toHaveLength(1);
    expect(result[0].delta).toBeCloseTo(3300, 0);
  });
});

describe("getAnomalyInsight", () => {
  const notifications = [
    { type: "SPEND_ANOMALY", title: "Unusual Spend: Dining", message: "A Dining expense of ₹3000 is well above your usual ₹800 for this category — check it's expected.", createdAt: "2026-08-05T10:00:00Z" },
    { type: "SPEND_ANOMALY", title: "Unusual Spend: Fuel",   message: "A Fuel expense of ₹5000 is well above your usual ₹1200 for this category — check it's expected.",   createdAt: "2026-08-10T10:00:00Z" },
    { type: "BUDGET_EXCEEDED", title: "Budget exceeded: Rent", message: "irrelevant", createdAt: "2026-08-12T10:00:00Z" },
    { type: "SPEND_ANOMALY", title: "Unusual Spend: Old", message: "irrelevant", createdAt: "2026-07-01T10:00:00Z" },
  ];

  it("returns the most recent spend-anomaly notification within the given month", () => {
    expect(getAnomalyInsight(notifications, 2026, 8)).toEqual({
      title: "Unusual Spend: Fuel",
      message: "A Fuel expense of ₹5000 is well above your usual ₹1200 for this category — check it's expected.",
    });
  });

  it("ignores non-anomaly notification types", () => {
    const result = getAnomalyInsight(notifications, 2026, 8);
    expect(result?.title).not.toContain("Rent");
  });

  it("returns null when none fall within the given month", () => {
    expect(getAnomalyInsight(notifications, 2026, 9)).toBeNull();
  });

  it("returns null for an empty notification list", () => {
    expect(getAnomalyInsight([], 2026, 8)).toBeNull();
  });
});

describe("buildSmartInsights", () => {
  const anomaly = { title: "Unusual Spend: Dining", message: "A Dining expense of ₹3000 is well above your usual ₹800." };
  const deltas: SmartInsight[] = [
    { kind: "delta", category: "Groceries",  delta: 2000, projected: false },
    { kind: "delta", category: "Fuel",       delta: 1500, projected: false },
    { kind: "delta", category: "Shopping",   delta: 1200, projected: false },
  ];
  const forecast = { amount: 5000, pctVsAvg: 10 };

  it("returns an empty list when nothing qualifies", () => {
    expect(buildSmartInsights(null, [], null)).toEqual([]);
  });

  it("does not cap the candidate list — SmartAlertsRow's own selection does that", () => {
    const result = buildSmartInsights(anomaly, deltas, forecast);
    // 1 anomaly + 3 deltas + 1 forecast — all 5 real candidates flow through uncapped, so a
    // downstream diversity-aware pick (SmartAlertsRow) still has the forecast/positive items to
    // choose from instead of them being silently dropped before that selection ever runs.
    expect(result).toHaveLength(5);
  });

  it("puts anomaly first, ahead of category deltas and the forecast", () => {
    const result = buildSmartInsights(anomaly, deltas, forecast);
    expect(result[0]).toEqual({ kind: "anomaly", title: anomaly.title, message: anomaly.message });
  });

  it("orders category deltas (already ranked by significance) before the forecast", () => {
    const result = buildSmartInsights(anomaly, deltas, forecast);
    expect(result[1]).toMatchObject({ kind: "delta", category: "Groceries" });
    expect(result[2]).toMatchObject({ kind: "delta", category: "Fuel" });
    expect(result[3]).toMatchObject({ kind: "delta", category: "Shopping" });
    expect(result[4]).toEqual({ kind: "forecast", amount: forecast.amount, pctVsAvg: forecast.pctVsAvg });
  });

  it("the forecast fills a slot when fewer deltas/anomaly are present", () => {
    const result = buildSmartInsights(null, deltas.slice(0, 1), forecast);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ kind: "forecast", amount: forecast.amount, pctVsAvg: forecast.pctVsAvg });
  });

  it("omits a kind entirely when its source is absent, without leaving a gap", () => {
    const result = buildSmartInsights(null, [], forecast);
    expect(result).toEqual([{ kind: "forecast", amount: forecast.amount, pctVsAvg: forecast.pctVsAvg }]);
  });
});
