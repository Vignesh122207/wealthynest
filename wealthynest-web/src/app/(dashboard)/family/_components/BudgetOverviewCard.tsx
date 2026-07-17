import { AlertTriangle, Target } from "lucide-react";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { cn } from "@/lib/utils";
import type { Budget } from "@/features/budgets/types/budget.types";

// ── Budget Overview ────────────────────────────────────────────────────────────

export function BudgetOverviewCard({ budgets, monthLabel, fmtC }: {
  budgets:    Budget[];
  monthLabel: string;
  fmtC: (n: number) => string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <PremiumIcon icon={Target} tone="violet" size="xs" />
        <h3 className="text-sm font-semibold text-foreground">
          Budget Overview — {monthLabel}
        </h3>
      </div>
      <div className="space-y-3">
        {budgets.slice(0, 6).map(b => {
          const pct = Math.min(b.percentUsed, 100);
          return (
            <div key={b.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">{b.categoryName ?? "Budget"}</span>
                <span className={cn("text-xs font-semibold tabular-nums", b.overBudget ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                  {fmtC(b.spent)} / {fmtC(b.amount)}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all",
                    b.overBudget ? "bg-red-500" : pct >= b.alertThreshold ? "bg-amber-500" : "bg-indigo-500")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {budgets.length > 6 && <p className="text-xs text-muted-foreground text-right">+{budgets.length - 6} more</p>}
      </div>
      {budgets.some(b => b.overBudget) && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {budgets.filter(b => b.overBudget).length} budget{budgets.filter(b => b.overBudget).length > 1 ? "s" : ""} over limit
        </div>
      )}
    </div>
  );
}
