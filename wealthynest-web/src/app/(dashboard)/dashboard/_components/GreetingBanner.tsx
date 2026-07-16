"use client";

import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { getGreeting, monthLabel } from "@/lib/utils";

interface GreetingBannerProps {
  firstName:      string;
  year:           number;
  month:          number;
  isCurrentMonth: boolean;
  onNavigate:     (dir: -1 | 1) => void;
  savingsRate:    number | undefined;
}

export function GreetingBanner({
  firstName, year, month, isCurrentMonth, onNavigate, savingsRate,
}: GreetingBannerProps) {
  const label = monthLabel(year, month);

  const insight = (() => {
    if (savingsRate == null) return null;
    if (savingsRate >= 40) return "Outstanding savings rate. You're building real wealth!";
    if (savingsRate >= 25) return "Strong savings discipline. Keep the momentum going.";
    if (savingsRate >= 15) return "Good progress. A little more savings each month adds up fast.";
    if (savingsRate >= 5)  return "You're saving something — let's work on growing that.";
    if (savingsRate > 0)   return "Small wins count. Try to cut one expense this week.";
    return "Expenses exceeded income this month. Let's review your spending.";
  })();

  return (
    <div className="animate-fade-in-up flex flex-row items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl" aria-hidden>
            {{ morning: "🌤️", afternoon: "☀️", evening: "🌙" }[getGreeting()] ?? "👋"}
          </span>
          <p className="text-lg lg:text-xl font-bold text-foreground tracking-tight truncate">
            Good {getGreeting()}, {firstName}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Here&apos;s your financial overview for <span className="font-semibold text-foreground">{label}</span>
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {insight && (
          <div className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15">
            <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
            <p className="text-xs font-medium text-primary/90">{insight}</p>
          </div>
        )}

        {/* Month navigator */}
        <div className="flex items-center gap-1 bg-card border border-border/50 rounded-xl p-1 shrink-0">
          <button
            onClick={() => onNavigate(-1)}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/60 flex items-center justify-center transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <span className="text-xs font-semibold text-foreground min-w-[4.5rem] text-center tabular-nums">
            {label}
          </span>
          <button
            onClick={() => onNavigate(1)}
            disabled={isCurrentMonth}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/60 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next month"
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
