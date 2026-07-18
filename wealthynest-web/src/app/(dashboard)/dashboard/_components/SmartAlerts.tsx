"use client";

import Link from "next/link";
import {Bell, Lightbulb, RefreshCw, X} from "lucide-react";
import {cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import type {Expense} from "@/features/expenses/types/expense.types";

interface SmartInsight {
  category: string;
  delta:    number;
}

interface SmartAlertsProps {
  smartInsights:        SmartInsight[];
  upcomingBills:        Expense[];
  overBudgetCount:      number;
  overBudgetDismissed:  boolean;
  onDismissOverBudget:  () => void;
}

export function SmartAlerts({
  smartInsights, upcomingBills, overBudgetCount, overBudgetDismissed, onDismissOverBudget,
}: SmartAlertsProps) {
  const { fmt } = useAmountFormatter();
  const hasAlerts = !overBudgetDismissed && overBudgetCount > 0;
  const hasInsights = smartInsights.length > 0;
  const hasBills    = upcomingBills.length > 0;

  if (!hasAlerts && !hasInsights && !hasBills) return null;

  return (
    <div className="space-y-3 animate-fade-in-up delay-225">
      {/* Over-budget alert */}
      {hasAlerts && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <span className="text-base shrink-0">⚠️</span>
          <p className="flex-1 text-sm font-medium text-amber-700 dark:text-amber-300">
            You have {overBudgetCount} budget{overBudgetCount > 1 ? "s" : ""} over limit this month.
            <Link href="/budgets" className="ml-2 underline underline-offset-2">View budgets →</Link>
          </p>
          <button onClick={onDismissOverBudget}
            className="text-amber-500 hover:text-amber-600 dark:hover:text-amber-300 transition-colors shrink-0 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {(hasInsights || hasBills) && (
        <div className="grid md:grid-cols-2 gap-3">
          {/* Smart Insights */}
          {hasInsights && (
            <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <PremiumIcon icon={Lightbulb} tone="yellow" size="xs" />
                <p className="text-xs font-semibold text-foreground">Smart Insights</p>
              </div>
              {smartInsights.map((insight, i) => (
                <div key={i} className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5",
                  insight.delta > 0
                    ? "bg-amber-500/8 border border-amber-500/15"
                    : "bg-emerald-500/8 border border-emerald-500/15"
                )}>
                  <span className={cn(
                    "text-xs font-bold shrink-0 tabular-nums",
                    insight.delta > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {insight.delta > 0 ? "+" : ""}{fmt(insight.delta)}
                  </span>
                  <p className="text-xs text-muted-foreground leading-snug min-w-0 truncate">
                    in <span className="font-semibold text-foreground">{insight.category}</span> vs last month
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming Bills */}
          {hasBills && (
            <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <PremiumIcon icon={Bell} tone="purple" size="xs" />
                <p className="text-xs font-semibold text-foreground">Upcoming Bills — Next 7 Days</p>
              </div>
              <div className="space-y-2">
                {upcomingBills.slice(0, 4).map((bill) => {
                  const d = new Date(bill.expenseDate);
                  const dayName = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
                  return (
                    <div key={bill.id} className="flex items-center justify-between gap-2 py-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <RefreshCw className="w-3 h-3 text-violet-500 dark:text-violet-400 shrink-0" />
                        <span className="text-xs text-foreground truncate">
                          {bill.description || bill.categoryName || "Recurring"}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-red-500 dark:text-red-400 tabular-nums">
                          −{fmt(bill.amount)}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">{dayName}</p>
                      </div>
                    </div>
                  );
                })}
                {upcomingBills.length > 4 && (
                  <p className="text-xs text-muted-foreground/60 pt-0.5">
                    +{upcomingBills.length - 4} more upcoming
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
