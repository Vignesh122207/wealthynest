"use client";

import {AlertTriangle, Bell, Gauge, Lightbulb, RefreshCw, TrendingDown, TrendingUp} from "lucide-react";
import {cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import type {Expense} from "@/features/expenses/types/expense.types";

// Category-delta insights work for any browsed month; the other two (forecast/anomaly) are
// only ever built by the caller for the current month — see page.tsx's isCurrentMonth gate.
// `projected` on "delta" is true when it's a pace-projected full-month estimate for the
// in-progress month rather than a completed-month actual — see getCategoryDeltaInsights.
export type SmartInsight =
  | { kind: "delta";    category: string; delta: number; projected: boolean }
  | { kind: "forecast"; amount: number; pctVsAvg: number | null }
  | { kind: "anomaly";  title: string; message: string };

interface SmartAlertsProps {
  smartInsights: SmartInsight[];
  upcomingBills: Expense[];
}

export function SmartAlerts({ smartInsights, upcomingBills }: SmartAlertsProps) {
  const { fmt } = useAmountFormatter();
  const hasInsights = smartInsights.length > 0;
  const hasBills    = upcomingBills.length > 0;

  if (!hasInsights && !hasBills) return null;

  // Whichever of the two is present alone reclaims the whole row instead of leaving the
  // other grid column empty — same rule AttentionRow applies to the banner/DebtPulse pair.
  const wide = !(hasInsights && hasBills);

  return (
    <div data-testid="smart-alerts-row" className={cn("grid gap-3 animate-fade-in-up delay-225", !wide && "md:grid-cols-2")}>
      {/* Smart Insights */}
      {hasInsights && (
        <div data-testid="smart-insights-card" className={cn(
          "rounded-2xl border border-border/50 bg-card p-4 shadow-sm space-y-2",
          wide && "md:col-span-2"
        )}>
          <div className="flex items-center gap-2 mb-1">
            <PremiumIcon icon={Lightbulb} tone="yellow" size="xs" />
            <p className="text-xs font-semibold text-foreground">Smart Insights</p>
          </div>
          <div className={
            wide && smartInsights.length > 1
              ? "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
              : "space-y-2"
          }>
            {smartInsights.map((insight, i) => {
              if (insight.kind === "anomaly") {
                return (
                  <div key={i} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 bg-red-500/8 border border-red-500/15">
                    <PremiumIcon icon={AlertTriangle} tone="red" size="xs" />
                    <p className="text-xs text-foreground/90 leading-snug min-w-0">{insight.message}</p>
                  </div>
                );
              }
              if (insight.kind === "forecast") {
                const good = insight.pctVsAvg == null || insight.pctVsAvg <= 0;
                return (
                  <div key={i} className={cn(
                    "flex items-start gap-2.5 rounded-xl px-3 py-2.5",
                    good ? "bg-emerald-500/8 border border-emerald-500/15" : "bg-amber-500/8 border border-amber-500/15"
                  )}>
                    <PremiumIcon icon={Gauge} tone={good ? "green" : "yellow"} size="xs" />
                    <p className="text-xs text-foreground/90 leading-snug min-w-0">
                      You&apos;re on pace to save <span className="font-semibold tabular-nums">{fmt(insight.amount)}</span> this month
                      {insight.pctVsAvg != null && (
                        <> — <span className="font-semibold">
                          {Math.abs(Math.round(insight.pctVsAvg))}% {insight.pctVsAvg >= 0 ? "above" : "below"}
                        </span> your 6-month average</>
                      )}.
                    </p>
                  </div>
                );
              }
              const up = insight.delta > 0;
              const verb = insight.projected ? "You're on pace to spend" : "You spent";
              return (
                <div key={i} className={cn(
                  "flex items-start gap-2.5 rounded-xl px-3 py-2.5",
                  up ? "bg-amber-500/8 border border-amber-500/15" : "bg-emerald-500/8 border border-emerald-500/15"
                )}>
                  <PremiumIcon icon={up ? TrendingUp : TrendingDown} tone={up ? "yellow" : "green"} size="xs" />
                  <p className="text-xs text-foreground/90 leading-snug min-w-0">
                    {verb} <span className="font-semibold tabular-nums">{fmt(Math.abs(insight.delta))}</span> {up ? "more" : "less"} on{" "}
                    <span className="font-semibold">{insight.category}</span> than last month.
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Bills */}
      {hasBills && (
        <div data-testid="upcoming-bills-card" className={cn(
          "bg-card border border-border/50 rounded-2xl p-4 shadow-sm",
          wide && "md:col-span-2"
        )}>
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
                    <p className="text-[10px] text-muted-foreground/80">{dayName}</p>
                  </div>
                </div>
              );
            })}
            {upcomingBills.length > 4 && (
              <p className="text-xs text-muted-foreground/80 pt-0.5">
                +{upcomingBills.length - 4} more upcoming
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
