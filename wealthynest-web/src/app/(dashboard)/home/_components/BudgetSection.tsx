"use client";

import Link from "next/link";
import {Target} from "lucide-react";
import {cn, monthLabel} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {getCategoryColor, getCategoryIcon} from "@/lib/categoryMeta";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {EmptyState} from "@/components/shared/EmptyState";
import type {BudgetSummary} from "@/features/dashboard/types/dashboard.types";

interface BudgetSectionProps {
  budgetSummaries: BudgetSummary[];
  viewMode:        "month" | "year";
  year:            number;
  month:           number;
  isLoading:       boolean;
}

// Matches Recent Transactions' cap exactly
const DISPLAY_COUNT = 8;

// Soft peachy-coral (Tailwind orange-300) for the over-budget icon ring — warm enough to read as
// "alert" without the harsh, saturated red the bar/badge used to carry, and close enough in hue to
// the orange-500 warning bar below that the two read as one coherent alert language, not two
// clashing signals.
const OVER_BUDGET_ICON_HEX = "#FDBA74";

export function BudgetSection({ budgetSummaries, viewMode, year, month, isLoading }: BudgetSectionProps) {
  // Caller (home/page.tsx) already filters budgetSummaries to MONTHLY vs YEARLY based on
  // viewMode, matching StatOverview's Budget Progress ring — this just needs to label whichever
  // period that filtered set actually represents instead of always showing the month.
  const label = viewMode === "year" ? String(year) : monthLabel(year, month);
  const { fmtC } = useAmountFormatter();

  // Sorted by spending percentage (most at-risk first), not raw amount spent
  const visible = [...budgetSummaries].sort((a, b) => b.percentUsed - a.percentUsed).slice(0, DISPLAY_COUNT);

  return (
    <div data-testid="budget-section" className="bg-card rounded-2xl border border-slate-100/80 dark:border-border/50 shadow-soft dark:shadow-none p-4 animate-fade-in-up delay-300 h-full flex flex-col card-hover">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-foreground text-sm">Budget Progress</h2>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">{label}</p>
        </div>
        <Link href="/budgets"
          className="text-xs font-semibold text-primary hover:underline transition-colors">
          View all →
        </Link>
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col justify-center space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-24 rounded-lg shimmer" />
                <div className="h-3 w-16 rounded-lg shimmer" />
              </div>
              <div className="h-2 w-full rounded-full shimmer" />
            </div>
          ))}
        </div>
      ) : budgetSummaries.length > 0 ? (
        <div className="flex-1 flex flex-col justify-center space-y-4">
          {visible.map((b) => {
            const icon    = getCategoryIcon({ name: b.categoryName, icon: b.categoryIcon });
            const color   = getCategoryColor(b.categoryName, b.categoryColor);
            const pct     = Math.min(100, b.percentUsed); // never past 100 — the fill can't overrun the track even when percentUsed itself is 139
            const atRisk  = b.overBudget || b.percentUsed > 80;
            return (
              <div key={b.categoryId}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Over-budget now reads from the icon ring itself (a soft coral tint) instead
                        of a separate "Over" text badge next to every at-risk category name. */}
                    <PremiumIcon icon={icon} hex={b.overBudget ? OVER_BUDGET_ICON_HEX : color} size="xs" />
                    <span className="text-sm font-medium text-foreground truncate">{b.categoryName}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-xs text-muted-foreground/70 tabular-nums">
                      {fmtC(b.spent)} / {fmtC(b.budgeted)}
                    </span>
                    <span className={cn(
                      "text-xs font-bold w-9 text-right tabular-nums",
                      atRisk ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"
                    )}>
                      {b.percentUsed.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", atRisk ? "bg-orange-500" : "bg-emerald-500")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title={viewMode === "year" ? "No yearly budgets set" : "No budgets set for this month"}
          description="Set spending limits by category to keep your budget on track."
          action={<Link href="/budgets" className="text-xs font-semibold text-primary hover:underline">Set up budgets →</Link>}
          className="flex-1"
        />
      )}
    </div>
  );
}
