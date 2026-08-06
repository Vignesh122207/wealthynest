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

interface SmartInsightsCardProps {
  insights: SmartInsight[];
  /** True when this card has the full row to itself — lets its 3 insights lay out side by
   * side instead of stacking, matching whatever column span the parent row gave it. */
  wide: boolean;
}

export function SmartInsightsCard({ insights, wide }: SmartInsightsCardProps) {
  const { fmt } = useAmountFormatter();
  if (insights.length === 0) return null;

  return (
    <div data-testid="smart-insights-card" className={cn(
      "rounded-2xl border border-border/50 bg-card p-4",
      wide && "md:col-span-2"
    )}>
      <div className="flex items-center gap-2 mb-1">
        <PremiumIcon icon={Lightbulb} tone="yellow" size="xs" />
        <h2 className="font-bold text-foreground text-sm">Smart Insights</h2>
      </div>
      <div className={cn(
        "divide-y divide-border/40",
        wide && insights.length > 1 && "sm:divide-y-0 sm:grid sm:gap-x-4 sm:grid-cols-2 lg:grid-cols-3"
      )}>
        {insights.map((insight, i) => {
          if (insight.kind === "anomaly") {
            return (
              <div key={i} className="flex items-start gap-2.5 py-2.5 first:pt-1.5 sm:first:pt-2.5">
                <PremiumIcon icon={AlertTriangle} tone="red" size="xs" />
                <p className="text-xs text-foreground/90 leading-snug min-w-0">{insight.message}</p>
              </div>
            );
          }
          if (insight.kind === "forecast") {
            const good = insight.pctVsAvg == null || insight.pctVsAvg <= 0;
            return (
              <div key={i} className="flex items-start gap-2.5 py-2.5 first:pt-1.5 sm:first:pt-2.5">
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
            <div key={i} className="flex items-start gap-2.5 py-2.5 first:pt-1.5 sm:first:pt-2.5">
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
  );
}

interface UpcomingBillsCardProps {
  bills: Expense[];
  wide: boolean;
}

export function UpcomingBillsCard({ bills, wide }: UpcomingBillsCardProps) {
  const { fmt } = useAmountFormatter();
  if (bills.length === 0) return null;

  return (
    <div data-testid="upcoming-bills-card" className={cn(
      "bg-card border border-border/50 rounded-2xl p-4",
      wide && "md:col-span-2"
    )}>
      <div className="flex items-center gap-2 mb-1">
        <PremiumIcon icon={Bell} tone="purple" size="xs" />
        <h2 className="font-bold text-foreground text-sm">Upcoming Bills — Next 7 Days</h2>
      </div>
      <div className="divide-y divide-border/40">
        {bills.slice(0, 4).map((bill) => {
          const d = new Date(bill.expenseDate);
          const dayName = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
          return (
            <div key={bill.id} className="flex items-center justify-between gap-2 py-2 first:pt-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <PremiumIcon icon={RefreshCw} tone="violet" size="xs" />
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
        {bills.length > 4 && (
          <p className="text-xs text-muted-foreground/80 pt-2">
            +{bills.length - 4} more upcoming
          </p>
        )}
      </div>
    </div>
  );
}

interface SmartAlertsRowProps {
  smartInsights: SmartInsight[];
  upcomingBills: Expense[];
}

// The Home dashboard's only alert row now — Smart Insights + Upcoming Bills pair up when both
// are present; whichever one is alone reclaims the full row instead of leaving the other column
// empty.
export function SmartAlertsRow({ smartInsights, upcomingBills }: SmartAlertsRowProps) {
  const hasInsights = smartInsights.length > 0;
  const hasBills    = upcomingBills.length > 0;
  if (!hasInsights && !hasBills) return null;

  const paired = hasInsights && hasBills;

  return (
    <div data-testid="smart-alerts-row" className={cn("grid items-start gap-3 animate-fade-in-up delay-225", paired && "md:grid-cols-2")}>
      {hasInsights && <SmartInsightsCard insights={smartInsights} wide={!paired} />}
      {hasBills && <UpcomingBillsCard bills={upcomingBills} wide={!paired} />}
    </div>
  );
}
