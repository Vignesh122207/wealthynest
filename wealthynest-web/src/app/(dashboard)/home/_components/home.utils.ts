import type {MonthlyTrend} from "@/features/dashboard/types/dashboard.types";
import type {NetWorthHistoryPoint} from "@/features/networth/types/networth.types";

// Pure functions exported for testability without rendering — same precedent as
// GreetingBanner's getSavingsInsight.

/** How many months of the given year count as "year to date" — all 12 for a past year,
 * only up to (and including) the current calendar month for the current year. */
export function getYtdMonths(year: number, now: Date): number {
  return year === now.getFullYear() ? now.getMonth() + 1 : 12;
}

/** Sums the first `months` entries of an annual trend array (index 0 = January, per
 * AnalyticsServiceImpl#getAnnualTrend's own month-1-to-12 loop). */
export function sumTrend(trend: MonthlyTrend[], months: number): { income: number; expenses: number } {
  const slice = trend.slice(0, months);
  return {
    income:   slice.reduce((s, t) => s + t.income, 0),
    expenses: slice.reduce((s, t) => s + t.expenses, 0),
  };
}

/** Baseline net-worth snapshot for "since Jan 1 of this year" — the year's January point,
 * falling back to that year's earliest available point (if Jan hasn't been snapshotted yet),
 * then to the very first history point overall (a year with no snapshots at all yet). */
export function getNetWorthBaseline(history: NetWorthHistoryPoint[], year: number): NetWorthHistoryPoint | undefined {
  return history.find(p => p.year === year && p.month === 1)
    ?? history.find(p => p.year === year)
    ?? history[0];
}

export interface PaceForecast {
  amount:    number;
  pctVsAvg: number | null;
}

/** Projects this month's full-month savings from the pace set so far (income/expenses to
 * date, extrapolated across the whole month), compared against the average of prior months'
 * actual savings. `pctVsAvg` is null when there's no prior-month history to compare against
 * (too new an account), that average is exactly zero (a % comparison against zero is
 * meaningless), or the comparison would be nonsensical (see PACE_PCT_SANITY_CAP below) —
 * callers show the projected amount alone in that case.
 *
 * Returns null outright before day 5 of the month: extrapolating from only a few days
 * multiplies whatever happened so far by daysInMonth/dayOfMonth (day 1 → ~30x), so one
 * lumpy transaction (a bonus, an FD maturity) produces a wildly unstable "pace" and an
 * even wilder pctVsAvg against a normal-sized average. Waiting for a working week's worth
 * of data keeps the extrapolation multiplier under ~6x. */
const PACE_PCT_SANITY_CAP = 500;

export function getPaceForecast(
  income: number | undefined,
  expenses: number | undefined,
  dayOfMonth: number,
  daysInMonth: number,
  priorMonthsSaved: number[],
): PaceForecast | null {
  if (income == null && expenses == null) return null;
  if (dayOfMonth < 5 || daysInMonth <= 0) return null;

  const projected = ((income ?? 0) - (expenses ?? 0)) / dayOfMonth * daysInMonth;
  const validPrior = priorMonthsSaved.filter(v => Number.isFinite(v));
  if (validPrior.length === 0) return { amount: projected, pctVsAvg: null };

  const avg = validPrior.reduce((s, v) => s + v, 0) / validPrior.length;
  if (avg === 0) return { amount: projected, pctVsAvg: null };

  const pctVsAvg = ((projected - avg) / Math.abs(avg)) * 100;
  // The day-5 gate above only bounds the *date*-extrapolation multiplier (~6x) — it does nothing
  // for a single unusually large one-time transaction (a bonus, an FD maturity) landing early in
  // the month, which still produces a technically-correct but meaningless-looking percentage
  // (e.g. "4606% above average") once compared against a normal-sized prior-month average. Past
  // this point the comparison itself has stopped being informative, so drop it and fall back to
  // showing the projected amount alone — same treatment as the avg === 0 case above.
  if (Math.abs(pctVsAvg) > PACE_PCT_SANITY_CAP) return { amount: projected, pctVsAvg: null };

  return { amount: projected, pctVsAvg };
}

export interface CategoryDelta {
  category:  string;
  delta:     number;
  /** True when `delta` is a pace-projected full-month estimate rather than a completed-month
   * actual — callers word these two cases differently (a projection, not a settled fact). */
  projected: boolean;
}

interface CategorySpendLike {
  categoryId:   string;
  categoryName: string;
  amount:       number;
}

/** Category-level spend deltas vs. the prior period. Comparing a still-in-progress month's
 * spend-so-far against a completed prior month is apples-to-oranges — early in the month every
 * category looks "down" purely because fewer days have passed, not because of any real change in
 * behavior. For the current month this pace-projects each category's month-to-date amount to a
 * full-month estimate (same elapsed-day run-rate math as getPaceForecast) before comparing, and
 * returns [] outright before day 7 — a single category's spend is lower-volume/noisier than total
 * income/expenses, so it needs a few more data points than getPaceForecast's own day-5 gate before
 * the projection is stable. A past (already-closed) month skips both the gate and the projection —
 * both sides of the comparison are already complete, so the raw delta is already a valid fact. */
export function getCategoryDeltaInsights(
  current:  CategorySpendLike[],
  previous: CategorySpendLike[],
  opts: { isCurrentMonth: boolean; dayOfMonth: number; daysInMonth: number; avgMonthlySpend: number },
): CategoryDelta[] {
  const { isCurrentMonth, dayOfMonth, daysInMonth, avgMonthlySpend } = opts;
  if (isCurrentMonth && dayOfMonth < 7) return [];

  const projected = isCurrentMonth && daysInMonth > 0;
  const prevMap    = new Map(previous.map(c => [c.categoryId, c.amount]));
  const threshold  = Math.max(100, avgMonthlySpend * 0.05);

  const deltas: CategoryDelta[] = [];
  for (const c of current) {
    const prev   = prevMap.get(c.categoryId) ?? 0;
    const amount = projected ? (c.amount / dayOfMonth) * daysInMonth : c.amount;
    const delta  = amount - prev;
    if (Math.abs(delta) >= threshold) deltas.push({ category: c.categoryName, delta, projected });
  }
  return deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
}

export interface AnomalyInsight {
  title:   string;
  message: string;
}

interface AnomalyNotificationLike {
  type:      string;
  title:     string;
  message:   string;
  createdAt: string;
}

/** Most recent spend-anomaly notification for the given month — reuses the server's own
 * already-composed title/message (SpendAnomalyScheduler → createSpendAnomalyNotification)
 * rather than re-deriving the multiplier/category client-side. */
export function getAnomalyInsight(
  notifications: AnomalyNotificationLike[],
  year: number,
  month: number,
): AnomalyInsight | null {
  const matches = notifications
    .filter(n => n.type.includes("SPEND_ANOMALY"))
    .filter(n => {
      const d = new Date(n.createdAt);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const top = matches[0];
  return top ? { title: top.title, message: top.message } : null;
}
