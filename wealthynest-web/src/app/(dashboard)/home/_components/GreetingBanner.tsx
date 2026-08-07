"use client";

import {Calendar, CalendarRange, ChevronLeft, ChevronRight, Zap} from "lucide-react";
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
}

// Exported as a pure function so it's testable without rendering the component.
// savingsRate is left un-floored by the API now, so a genuine overspend (expenses > income)
// reads as negative and an exact break-even month reads as a true 0 — the two used to be
// indistinguishable (both landed on 0) and both got the same "exceeded" wording, which was wrong
// for break-even. Separately, logging expenses against zero income used to go silent (same `!income`
// guard that correctly suppresses the "no data at all" case) — that's worth its own callout instead.
export function getSavingsInsight(
  income: number | undefined, expenses: number | undefined, savingsRate: number | undefined,
  // Defaults to the raw (unmasked, INR-locale) formatter so every existing call site/test keeps
  // its current behavior — the component below passes useAmountFormatter's `fmt` instead, so the
  // one amount embedded in this insight's copy respects Privacy Mode and the user's currency
  // exactly like every other number on the page (this was the one spot on Home that didn't).
  formatAmount: (amount: number) => string = formatCurrency,
): string | null {
  if (savingsRate == null) return null;
  if (!income) {
    if (!expenses) return null;
    return `No income logged this month, but ${formatAmount(expenses)} in expenses — that's coming out of savings.`;
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
  const { fmt } = useAmountFormatter();
  const insight = getSavingsInsight(income, expenses, savingsRate, fmt);

  return (
    // Always a single row, even on mobile (previously flex-col below sm, which pushed the
    // period controls onto their own line) — the greeting gets flex-1/min-w-0 so it's first in
    // line for the row's space and only truncates as a last resort; the controls on the right
    // are shrink-0 and, below sm, collapse into one compact icon-driven pill (see the mobile-only
    // block further down) specifically so they never need to squeeze the greeting to fit.
    <div data-testid="greeting-banner" className="animate-fade-in-up flex flex-row items-center justify-between gap-2 sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl shrink-0" aria-hidden>
            {{ morning: "🌤️", afternoon: "☀️", evening: "🌙" }[getGreeting()] ?? "👋"}
          </span>
          <p className="text-base sm:text-lg lg:text-xl font-bold text-foreground tracking-tight truncate">
            Good {getGreeting()}, {firstName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {insight && (
          <div className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15">
            <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
            <p className="text-xs font-medium text-primary/90">{insight}</p>
          </div>
        )}

        {/* Month/Year switch — sm and up only; mobile gets the single combined pill below */}
        <div className="hidden sm:flex items-center gap-0.5 bg-card border border-border/50 rounded-xl p-1 shrink-0">
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

        {/* Month/Year navigator — sm and up only; mobile gets the single combined pill below */}
        <div className="hidden sm:flex items-center gap-1 bg-card border border-border/50 rounded-xl p-1 shrink-0">
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

        {/* Mobile-only: the two pills above collapse into one lean pill — the Month/Year
            segmented control (two text buttons) and its icon merge into a single tap-to-cycle
            "icon + label" button (no separate button chrome for the icon, no fixed-width label
            reservation), and prev/next shrink to 20px. Every px here is deliberately fought for:
            this is what keeps "Good morning, {name}" from ever needing to truncate on a mainstream
            phone width (measured against real devices, not just guessed) while still sharing the
            row with full period navigation instead of wrapping to a second line. */}
        <div className="flex sm:hidden items-center gap-1 bg-card border border-border/50 rounded-xl pl-1.5 pr-1 py-1 shrink-0">
          <button
            data-testid="period-toggle-mobile"
            onClick={() => onViewModeChange(isYear ? "month" : "year")}
            aria-label={`${isYear ? "Switch to month view" : "Switch to year view"} — currently showing ${label}`}
            className="flex items-center gap-1 text-primary"
          >
            {isYear ? <CalendarRange className="w-3.5 h-3.5 shrink-0" /> : <Calendar className="w-3.5 h-3.5 shrink-0" />}
            <span data-testid="period-nav-label-mobile" className="text-[11px] font-semibold text-foreground tabular-nums whitespace-nowrap">
              {label}
            </span>
          </button>
          <button
            onClick={() => (isYear ? onNavigateYear(-1) : onNavigate(-1))}
            className="w-5 h-5 rounded-md hover:bg-muted/60 flex items-center justify-center transition-colors"
            aria-label={isYear ? "Previous year" : "Previous month"}
          >
            <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={() => (isYear ? onNavigateYear(1) : onNavigate(1))}
            disabled={isYear ? isCurrentYear : isCurrentMonth}
            className="w-5 h-5 rounded-md hover:bg-muted/60 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={isYear ? "Next year" : "Next month"}
          >
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
