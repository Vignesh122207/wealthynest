"use client";

import {ChevronLeft, ChevronRight, Zap} from "lucide-react";
import {cn, formatCurrency, getGreeting, monthLabel} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";

export type HomeViewMode = "month" | "year";

interface GreetingBannerProps {
  firstName:        string;
  year:             number;
  month:            number;
  isCurrentMonth:   boolean;
  isCurrentYear:    boolean;
  onNavigate:       (dir: -1 | 1) => void;
  onNavigateYear:   (dir: -1 | 1) => void;
  viewMode:         HomeViewMode;
  onViewModeChange: (mode: HomeViewMode) => void;
  income:           number | undefined;
  expenses:         number | undefined;
  savingsRate:      number | undefined;
  /** Hero figure — this is the merged Greeting + Net Worth hero now, so it owns the headline
   * number StatOverview used to render as just another tile. */
  netWorth:         number | undefined;
  netWorthDeltaPct: number | undefined;
  /** Recent net-worth-history values (oldest→newest), sparse is fine — the sparkline just needs
   * ≥2 points and renders nothing below that. */
  netWorthSpark:    number[];
  isLoading:        boolean;
}

// Small inline trend line for the hero figure — deliberately not a Recharts chart (that's a lot
// of bundle/DOM for an 84×26 decoration): a plain normalized polyline is all this needs.
function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const w = 84, h = 26;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true">
      <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

// Exported as a pure function so it's testable without rendering the component.
// savingsRate is left un-floored by the API now, so a genuine overspend (expenses > income)
// reads as negative and an exact break-even month reads as a true 0 — the two used to be
// indistinguishable (both landed on 0) and both got the same "exceeded" wording, which was wrong
// for break-even. Separately, logging expenses against zero income used to go silent (same `!income`
// guard that correctly suppresses the "no data at all" case) — that's worth its own callout instead.
export function getSavingsInsight(
  income: number | undefined, expenses: number | undefined, savingsRate: number | undefined,
): string | null {
  if (savingsRate == null) return null;
  if (!income) {
    if (!expenses) return null;
    return `No income logged this month, but ${formatCurrency(expenses)} in expenses — that's coming out of savings.`;
  }
  if (savingsRate >= 40) return "Outstanding savings rate. You're building real wealth!";
  if (savingsRate >= 25) return "Strong savings discipline. Keep the momentum going.";
  if (savingsRate >= 15) return "Good progress. A little more savings each month adds up fast.";
  if (savingsRate >= 5)  return "You're saving something — let's work on growing that.";
  if (savingsRate > 0)   return "Small wins count. Try to cut one expense this week.";
  if (savingsRate === 0) return "You spent exactly what you earned this month — nothing left over.";
  return `Expenses exceeded income by ${Math.abs(Math.round(savingsRate))}% this month.`;
}

export function GreetingBanner({
  firstName, year, month, isCurrentMonth, isCurrentYear, onNavigate, onNavigateYear,
  viewMode, onViewModeChange, income, expenses, savingsRate,
  netWorth, netWorthDeltaPct, netWorthSpark, isLoading,
}: GreetingBannerProps) {
  const { fmt } = useAmountFormatter();
  const isYear = viewMode === "year";
  const label  = isYear ? String(year) : monthLabel(year, month);
  const insight = getSavingsInsight(income, expenses, savingsRate);
  const deltaGood = netWorthDeltaPct != null ? netWorthDeltaPct >= 0 : undefined;

  return (
    <div data-testid="greeting-banner" className="px-5 pt-4 pb-3 md:px-6 md:pt-5 md:pb-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground/90">
            Good {getGreeting()}, <span className="text-foreground font-semibold">{firstName}</span>
            {" — "}{isYear ? "net worth this year" : "net worth"}
          </p>

          {isLoading ? (
            <div className="h-8 w-44 rounded-xl shimmer mt-2" />
          ) : (
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span data-testid="hero-net-worth"
                className="font-serif text-[28px] sm:text-[34px] leading-[1.15] font-semibold tabular-nums text-foreground">
                {netWorth != null ? fmt(netWorth) : "—"}
              </span>
              {deltaGood != null && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                  deltaGood ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500 dark:text-red-400"
                )}>
                  {deltaGood ? "↑" : "↓"} {Math.abs(netWorthDeltaPct!).toFixed(1)}%
                </span>
              )}
              <Sparkline data={netWorthSpark} className="hidden sm:block text-primary" />
            </div>
          )}

          {insight && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground/90 mt-1.5 max-w-md">
              <Zap className="w-3 h-3 text-primary shrink-0" />
              <span className="truncate">{insight}</span>
            </p>
          )}
        </div>

        {/* Month/Year switch + navigator share one row — a single compact control cluster
            instead of two stacked ones. */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-0.5 bg-muted/60 rounded-xl p-1 shrink-0">
            {(["month", "year"] as const).map((mode) => (
              <button
                key={mode}
                data-testid={`period-toggle-${mode}`}
                onClick={() => onViewModeChange(mode)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors",
                  viewMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card"
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1 shrink-0">
            <button
              onClick={() => (isYear ? onNavigateYear(-1) : onNavigate(-1))}
              className="w-7 h-7 rounded-lg hover:bg-card flex items-center justify-center transition-colors"
              aria-label={isYear ? "Previous year" : "Previous month"}
            >
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span data-testid="period-nav-label" className="text-xs font-semibold text-foreground min-w-[4.5rem] text-center tabular-nums">
              {label}
            </span>
            <button
              onClick={() => (isYear ? onNavigateYear(1) : onNavigate(1))}
              disabled={isYear ? isCurrentYear : isCurrentMonth}
              className="w-7 h-7 rounded-lg hover:bg-card flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label={isYear ? "Next year" : "Next month"}
            >
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
