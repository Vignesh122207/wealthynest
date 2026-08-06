"use client";

import Link from "next/link";
import {AlertTriangle, X} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import type {DebtRecord} from "@/features/debts/types/debt.types";
import type {Expense} from "@/features/expenses/types/expense.types";
import {DebtPulse} from "./DebtPulse";
import {SmartInsightsCard, UpcomingBillsCard, type SmartInsight} from "./SmartAlerts";

interface AlertsRowProps {
  overBudgetCount:     number;
  overBudgetDismissed: boolean;
  onDismissOverBudget: () => void;
  debts:               DebtRecord[];
  /** Which budget set `overBudgetCount` was computed from — Month mode counts monthly budgets
   * over limit, Year mode counts yearly ones (see StatOverview's matching ring), so the banner
   * text always agrees with whichever ring is currently showing. */
  periodLabel:         "month" | "year";
  smartInsights:       SmartInsight[];
  upcomingBills:       Expense[];
}

// Two fixed pairings, never cross-mixed: the over-budget banner + DebtPulse (both compact,
// fixed-shape alerts) share a row when both are present; Smart Insights + Upcoming Bills (both
// variable-length content cards) share a row when both are present. A lone leftover on one side
// (banner with no debt, say) never shares a row with a lone leftover on the other (Insights with
// no bills) — cross-pairing them looked clever on paper but never actually read as a matched
// pair in practice (wildly different natural heights), so each leftover just gets its own
// full-width row instead, in priority order.
export function AlertsRow({
  overBudgetCount, overBudgetDismissed, onDismissOverBudget, debts, periodLabel,
  smartInsights, upcomingBills,
}: AlertsRowProps) {
  const showBanner  = !overBudgetDismissed && overBudgetCount > 0;
  const hasDebts    = debts.some(d => d.status !== "SETTLED");
  const hasInsights = smartInsights.length > 0;
  const hasBills    = upcomingBills.length > 0;

  if (!showBanner && !hasDebts && !hasInsights && !hasBills) return null;

  const pairAlerts  = showBanner && hasDebts;
  const pairContent = hasInsights && hasBills;

  const bannerEl = showBanner && (
    <div data-testid="over-budget-banner" className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/8 px-4 py-3">
      <PremiumIcon icon={AlertTriangle} tone="red" size="xs" className="mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          You have {overBudgetCount} budget{overBudgetCount > 1 ? "s" : ""} over limit this {periodLabel}.
        </p>
        <Link href="/budgets" className="inline-block text-sm font-semibold text-red-700 dark:text-red-300 underline underline-offset-2">
          View budgets →
        </Link>
      </div>
      <button data-testid="over-budget-dismiss" onClick={onDismissOverBudget}
        className="text-red-500 hover:text-red-600 dark:hover:text-red-300 transition-colors shrink-0 p-1 -m-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const debtEl = hasDebts && (
    <div data-testid="debt-pulse-wrap">
      <DebtPulse debts={debts} />
    </div>
  );

  const insightsEl = hasInsights && <SmartInsightsCard insights={smartInsights} wide={!pairContent} />;
  const billsEl    = hasBills && <UpcomingBillsCard bills={upcomingBills} wide={!pairContent} />;

  return (
    <div data-testid="alerts-row" className="flex flex-col gap-3 animate-fade-in-up delay-225">
      {(showBanner || hasDebts) && (
        pairAlerts
          ? <div className="grid items-start gap-3 md:grid-cols-2">{bannerEl}{debtEl}</div>
          : (bannerEl || debtEl)
      )}
      {(hasInsights || hasBills) && (
        pairContent
          ? <div className="grid items-start gap-3 md:grid-cols-2">{insightsEl}{billsEl}</div>
          : (insightsEl || billsEl)
      )}
    </div>
  );
}
