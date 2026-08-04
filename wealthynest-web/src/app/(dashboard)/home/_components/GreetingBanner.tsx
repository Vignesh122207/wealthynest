"use client";

import {ChevronLeft, ChevronRight, Zap} from "lucide-react";
import {cn, formatCurrency, getGreeting, monthLabel} from "@/lib/utils";

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
}: GreetingBannerProps) {
  const isYear = viewMode === "year";
  const label  = isYear ? String(year) : monthLabel(year, month);
  const insight = getSavingsInsight(income, expenses, savingsRate);

  return (
    <div data-testid="greeting-banner" className="animate-fade-in-up flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl" aria-hidden>
            {{ morning: "🌤️", afternoon: "☀️", evening: "🌙" }[getGreeting()] ?? "👋"}
          </span>
          <p className="text-lg lg:text-xl font-bold text-foreground tracking-tight truncate">
            Good {getGreeting()}, {firstName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {insight && (
          <div className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15">
            <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
            <p className="text-xs font-medium text-primary/90">{insight}</p>
          </div>
        )}

        {/* Month/Year switch */}
        <div className="flex items-center gap-0.5 bg-card border border-border/50 rounded-xl p-1 shrink-0">
          {(["month", "year"] as const).map((mode) => (
            <button
              key={mode}
              data-testid={`period-toggle-${mode}`}
              onClick={() => onViewModeChange(mode)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors",
                viewMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Month/Year navigator */}
        <div className="flex items-center gap-1 bg-card border border-border/50 rounded-xl p-1 shrink-0">
          <button
            onClick={() => (isYear ? onNavigateYear(-1) : onNavigate(-1))}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/60 flex items-center justify-center transition-colors"
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
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/60 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={isYear ? "Next year" : "Next month"}
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
