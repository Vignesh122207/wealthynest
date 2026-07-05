"use client";

import { Banknote, Receipt, Sparkles, Sun, type LucideIcon } from "lucide-react";
import { cn, formatCurrency, monthLabel } from "@/lib/utils";
import type { MonthlyTrend } from "@/features/dashboard/types/dashboard.types";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SummaryCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className="w-9 h-9 rounded-xl shimmer" />
        <div className="w-14 h-5 rounded-full shimmer" />
      </div>
      <div className="h-7 w-32 rounded-lg shimmer mb-1.5" />
      <div className="h-3.5 w-20 rounded shimmer" />
    </div>
  );
}

// ── Single Card ───────────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon:      LucideIcon;
  iconColor: string;
  iconBg:    string;
  title:     string;
  subtitle:  string;
  value:     string;
  trend?:    number;
  delay?:    string;
}

function SummaryCard({
  icon: Icon, iconColor, iconBg, title, subtitle, value, trend, delay = "delay-0",
}: SummaryCardProps) {
  const trendUp      = trend != null && trend >= 0;
  const trendInRange = trend != null && Math.abs(trend) <= 500;

  return (
    <div className={cn(
      "bg-card rounded-2xl p-5 shadow-sm border border-border/50 card-hover animate-fade-in-up",
      delay
    )}>
      {/* Icon + trend badge */}
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
          <Icon className={cn("w-[18px] h-[18px]", iconColor)} strokeWidth={1.75} />
        </div>
        {trend !== undefined && trendInRange && (
          <span className={cn(
            "text-[11px] font-bold px-2 py-0.5 rounded-full",
            trendUp
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-500 dark:text-red-400"
          )}>
            {trendUp ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {trend !== undefined && !trendInRange && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">New</span>
        )}
      </div>

      {/* Value + labels */}
      <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight leading-none mb-1">
        {value}
      </p>
      <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide">{title}</p>
      <p className="text-[11px] text-muted-foreground/50 mt-0.5">{subtitle}</p>
    </div>
  );
}

// ── Cards Grid ────────────────────────────────────────────────────────────────

interface SummaryCardsProps {
  year:          number;
  month:         number;
  income:        number | undefined;
  expenses:      number | undefined;
  savingsRate:   number | undefined;
  todaySpending: number;
  incomeTrend:   number | undefined;
  expenseTrend:  number | undefined;
  trend:         MonthlyTrend[];
  isLoading:     boolean;
}

export function SummaryCards({
  year, month, income, expenses, savingsRate,
  todaySpending, incomeTrend, expenseTrend, isLoading,
}: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SummaryCardSkeleton key={i} />)}
      </div>
    );
  }

  const label       = monthLabel(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();
  const avgPerDay   = expenses && expenses > 0
    ? `avg ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 0 }).format(Math.round(expenses / daysInMonth))}/day`
    : label;

  const cards: SummaryCardProps[] = [
    {
      icon:      Banknote,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      iconBg:    "bg-emerald-500/10",
      title:     "Income",
      subtitle:  label,
      value:     income != null ? formatCurrency(income) : "—",
      trend:     incomeTrend,
      delay:     "delay-0",
    },
    {
      icon:      Receipt,
      iconColor: "text-rose-600 dark:text-rose-400",
      iconBg:    "bg-rose-500/10",
      title:     "Expenses",
      subtitle:  label,
      value:     expenses != null ? formatCurrency(expenses) : "—",
      trend:     expenseTrend !== undefined ? -expenseTrend : undefined,
      delay:     "delay-75",
    },
    {
      icon:      Sparkles,
      iconColor: "text-violet-600 dark:text-violet-400",
      iconBg:    "bg-violet-500/10",
      title:     "Savings Rate",
      subtitle:  label,
      value:     savingsRate != null && income ? `${savingsRate.toFixed(1)}%` : "—",
      delay:     "delay-150",
    },
    {
      icon:      Sun,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg:    "bg-amber-500/10",
      title:     "Today's Spending",
      subtitle:  avgPerDay,
      value:     formatCurrency(todaySpending),
      delay:     "delay-225",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <SummaryCard key={card.title} {...card} />
      ))}
    </div>
  );
}
