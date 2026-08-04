"use client";

import Link from "next/link";
import {AlertTriangle, X} from "lucide-react";
import {cn} from "@/lib/utils";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import type {DebtRecord} from "@/features/debts/types/debt.types";
import {DebtPulse} from "./DebtPulse";

interface AttentionRowProps {
  overBudgetCount:     number;
  overBudgetDismissed: boolean;
  onDismissOverBudget: () => void;
  debts:               DebtRecord[];
  /** Which budget set `overBudgetCount` was computed from — Month mode counts monthly budgets
   * over limit, Year mode counts yearly ones (see StatOverview's matching ring), so the banner
   * text always agrees with whichever ring is currently showing. */
  periodLabel:         "month" | "year";
}

// Over-budget banner + DebtPulse share one row: whichever is alone takes the full row,
// both split 1fr/1fr, neither renders nothing — the same "don't leave an orphan grid
// column" rule as SmartAlerts' Insights/Bills row, applied here since these two are the
// dashboard's other pair of independently-optional "something needs your attention" cards.
export function AttentionRow({
  overBudgetCount, overBudgetDismissed, onDismissOverBudget, debts, periodLabel,
}: AttentionRowProps) {
  const showBanner = !overBudgetDismissed && overBudgetCount > 0;
  const hasDebts   = debts.some(d => d.status !== "SETTLED");

  if (!showBanner && !hasDebts) return null;

  const wide = !(showBanner && hasDebts);

  return (
    <div data-testid="attention-row" className={cn("grid gap-3 animate-fade-in-up delay-225", !wide && "md:grid-cols-2")}>
      {showBanner && (
        <div data-testid="over-budget-banner" className={cn(
          "flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/8 px-4 py-3",
          wide && "md:col-span-2"
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
        <div data-testid="debt-pulse-wrap" className={cn(wide && "md:col-span-2")}>
          <DebtPulse debts={debts} />
        </div>
      )}
    </div>
  );
}
