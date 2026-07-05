"use client";

import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { cn, formatCurrency, formatCurrencyCompact, getGreeting, monthLabel } from "@/lib/utils";

interface GreetingBannerProps {
  firstName:       string;
  year:            number;
  month:           number;
  isCurrentMonth:  boolean;
  onNavigate:      (dir: -1 | 1) => void;
  netWorth:        number | undefined;
  prevNetWorth:    number | undefined;
  savingsRate:     number | undefined;
  netCashFlow:     number;
  isLoading:       boolean;
}

export function GreetingBanner({
  firstName, year, month, isCurrentMonth, onNavigate,
  netWorth, prevNetWorth, savingsRate, netCashFlow, isLoading,
}: GreetingBannerProps) {
  const label = monthLabel(year, month);

  const nwChange = netWorth != null && prevNetWorth != null && prevNetWorth !== 0
    ? ((netWorth - prevNetWorth) / Math.abs(prevNetWorth)) * 100
    : null;
  const nwUp = nwChange != null && nwChange >= 0;

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
    <div className="animate-fade-in-up">
      {/* Desktop: two-column card */}
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-0">

          {/* ── Left: greeting + insight ── */}
          <div className="flex-1 p-5 lg:p-7 border-b border-border/40 sm:border-b-0 sm:border-r sm:border-border/40">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl" aria-hidden>
                {{ morning: "🌤️", afternoon: "☀️", evening: "🌙" }[getGreeting()] ?? "👋"}
              </span>
              <p className="text-lg lg:text-xl font-bold text-foreground tracking-tight">
                Good {getGreeting()}, {firstName}
              </p>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Financial summary for <span className="font-semibold text-foreground">{label}</span>
            </p>

            {insight && (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15">
                <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-xs font-medium text-primary/90">{insight}</p>
              </div>
            )}
          </div>

          {/* ── Right: net worth + month nav ── */}
          <div className="p-5 lg:p-7 flex flex-col gap-4 sm:min-w-[260px]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                Net Worth
              </p>
              {/* Month navigator */}
              <div className="flex items-center gap-1">
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

            {isLoading ? (
              <div className="space-y-2">
                <div className="h-9 w-44 rounded-xl shimmer" />
                <div className="h-4 w-24 rounded-lg shimmer" />
              </div>
            ) : (
              <div>
                <p className="text-3xl lg:text-4xl font-bold text-foreground tabular-nums tracking-tight leading-none mb-2">
                  {netWorth != null ? formatCurrency(netWorth) : "—"}
                </p>
                <div className="flex items-center gap-2">
                  {nwChange != null && (
                    <span className={cn(
                      "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                      nwUp
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                    )}>
                      {nwUp
                        ? <TrendingUp className="w-3 h-3" />
                        : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(nwChange).toFixed(1)}% vs last month
                    </span>
                  )}
                  {netCashFlow !== 0 && (
                    <span className={cn(
                      "text-xs font-medium tabular-nums",
                      netCashFlow > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                    )}>
                      {netCashFlow > 0 ? "+" : ""}{formatCurrencyCompact(netCashFlow)} saved
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
