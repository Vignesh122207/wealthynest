"use client";

import Link from "next/link";
import {AlertTriangle, X} from "lucide-react";
import {cn} from "@/lib/utils";
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

type CardKey = "banner" | "debt" | "insights" | "bills";

// All four "something needs your attention" cards (over-budget banner, DebtPulse, Smart
// Insights, Upcoming Bills) share one reflowing 2-column row instead of splitting into two
// independently-stacked rows — whichever subset is present packs in pairs, and a trailing odd
// card out reclaims the full row instead of leaving its partner column empty.
//
// items-start (not the grid default of stretch): these cards have genuinely different natural
// heights — a 1-line DebtPulse pill next to a 3-item Smart Insights stack can differ by 150px+
// — and stretching the shorter one to match turns it into a mostly-empty bordered box. Top-
// aligning instead lets each card keep its own compact height; the leftover space below the
// shorter card is just page background, not a stretched card shell.
export function AlertsRow({
  overBudgetCount, overBudgetDismissed, onDismissOverBudget, debts, periodLabel,
  smartInsights, upcomingBills,
}: AlertsRowProps) {
  const showBanner  = !overBudgetDismissed && overBudgetCount > 0;
  const hasDebts    = debts.some(d => d.status !== "SETTLED");
  const hasInsights = smartInsights.length > 0;
  const hasBills    = upcomingBills.length > 0;

  const visible: CardKey[] = [
    ...(showBanner ? (["banner"] as const) : []),
    ...(hasDebts ? (["debt"] as const) : []),
    ...(hasInsights ? (["insights"] as const) : []),
    ...(hasBills ? (["bills"] as const) : []),
  ];
  if (visible.length === 0) return null;

  // Odd count out: the last card in reading order has no pair, so it spans both columns.
  const wideLast = visible.length % 2 === 1;
  const lastKey = visible[visible.length - 1];
  const isWide = (key: CardKey) => wideLast && key === lastKey;

  return (
    <div data-testid="alerts-row" className="grid items-start gap-3 animate-fade-in-up delay-225 md:grid-cols-2">
      {showBanner && (
        <div data-testid="over-budget-banner" className={cn(
          "flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/8 px-4 py-3",
          isWide("banner") && "md:col-span-2"
        )}>
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
      )}
      {hasDebts && (
        <div data-testid="debt-pulse-wrap" className={cn(isWide("debt") && "md:col-span-2")}>
          <DebtPulse debts={debts} />
        </div>
      )}
      {hasInsights && <SmartInsightsCard insights={smartInsights} wide={isWide("insights")} />}
      {hasBills && <UpcomingBillsCard bills={upcomingBills} wide={isWide("bills")} />}
    </div>
  );
}
