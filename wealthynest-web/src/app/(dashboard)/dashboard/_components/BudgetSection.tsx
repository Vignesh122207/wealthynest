"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import { cn, formatCurrencyCompact, monthLabel } from "@/lib/utils";
import { getCategoryColor, getCategoryMeta } from "@/lib/categoryMeta";
import type { BudgetSummary } from "@/features/dashboard/types/dashboard.types";

interface BudgetSectionProps {
  budgetSummaries: BudgetSummary[];
  year:            number;
  month:           number;
  isLoading:       boolean;
}

export function BudgetSection({ budgetSummaries, year, month, isLoading }: BudgetSectionProps) {
  const label = monthLabel(year, month);

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-300 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-foreground">Budget Progress</h3>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">{label}</p>
        </div>
        <Link href="/budgets"
          className="text-xs font-semibold text-primary hover:underline transition-colors">
          See all →
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
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
        <div className="space-y-4">
          {[...budgetSummaries].sort((a, b) => b.spent - a.spent).slice(0, 6).map((b) => {
            const meta     = getCategoryMeta(b.categoryName);
            const color    = getCategoryColor(b.categoryName, b.categoryColor);
            const pct      = Math.min(100, b.percentUsed);
            const barColor = b.overBudget ? "#ef4444" : b.percentUsed > 80 ? "#f59e0b" : color;
            const Icon     = meta.icon;
            return (
              <div key={b.categoryId}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color + "20" }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={1.75} />
                    </div>
                    <span className="text-sm font-medium text-foreground truncate">{b.categoryName}</span>
                    {b.overBudget && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 shrink-0">
                        Over
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-xs text-muted-foreground/70 tabular-nums">
                      {formatCurrencyCompact(b.spent)} / {formatCurrencyCompact(b.budgeted)}
                    </span>
                    <span className={cn(
                      "text-xs font-bold w-9 text-right tabular-nums",
                      b.overBudget ? "text-red-500" : b.percentUsed > 80 ? "text-amber-500" : "text-muted-foreground"
                    )}>
                      {b.percentUsed.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
          <Target className="w-10 h-10 text-muted-foreground/25 mb-1" />
          <p className="text-sm font-medium text-foreground">No budgets set for this month</p>
          <Link href="/budgets" className="text-xs text-primary hover:underline font-medium">
            Set up budgets →
          </Link>
        </div>
      )}
    </div>
  );
}
