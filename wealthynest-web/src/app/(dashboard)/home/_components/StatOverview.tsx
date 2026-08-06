"use client";

import {useMemo} from "react";
import {
    Banknote,
    type LucideIcon,
    PiggyBank,
    Receipt,
    Target,
    TrendingUp
} from "lucide-react";
import {cn, formatTrendDelta, pctChange} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {type IconTone} from "@/components/icons/PremiumIcon";
import {FlatIcon} from "@/components/icons/FlatIcon";
import type {Investment} from "@/features/investments/types/investment.types";
import type {BudgetSummary} from "@/features/dashboard/types/dashboard.types";

interface StatOverviewProps {
  viewMode:          "month" | "year";
  investments:       Investment[];
  income:            number | undefined;
  expenses:          number | undefined;
  savingsRate:       number | undefined;
  prevSavingsRate:   number | undefined;
  incomeTrend:       number | undefined;
  expenseTrend:      number | undefined;
  ytdIncome:            number | undefined;
  ytdExpenses:          number | undefined;
  ytdIncomeTrend:       number | undefined;
  ytdExpenseTrend:      number | undefined;
  ytdSavingsRate:       number | undefined;
  ytdSavingsRateTrend:  number | undefined;
  monthlyBudgets:    BudgetSummary[];
  yearlyBudgets:     BudgetSummary[];
  isLoading:         boolean;
}

interface TileProps {
  icon: LucideIcon; tone: IconTone;
  label: string; value: string;
  deltaText?: string; deltaGood?: boolean;
}

// A row cell, not a card — this renders inside the hero's shared border/background now (see
// GreetingBanner.tsx, composed together in page.tsx), so it carries no chrome of its own.
function StatCell({ icon, tone, label, value, deltaText, deltaGood }: TileProps) {
  return (
    <div className="flex-1 min-w-[112px] px-3.5 py-3.5 sm:px-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <FlatIcon icon={icon} tone={tone} size="xs" />
        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide truncate">{label}</p>
      </div>
      <p className="text-[15px] sm:text-base font-bold text-foreground tabular-nums tracking-tight leading-none">{value}</p>
      {deltaText ? (
        <p className={cn(
          "text-[10.5px] font-semibold tabular-nums mt-1.5",
          deltaGood == null ? "text-muted-foreground" : deltaGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
        )}>
          {deltaText}
        </p>
      ) : (
        <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary mt-1.5">New</span>
      )}
    </div>
  );
}

// Graded on total spend as a share of total budget — matches the 80%/100% thresholds
// BudgetSection.tsx already uses per-category (percentUsed > 80 → amber, overBudget → red), so
// this stays on the same scale as the rest of the page instead of inventing a second one.
type BudgetTier = "green" | "amber" | "red";
function spendTier(pct: number): BudgetTier {
  if (pct > 100) return "red";
  if (pct > 80)  return "amber";
  return "green";
}
const TIER_CAPTION: Record<BudgetTier, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red:   "text-red-500 dark:text-red-400",
};

// Flat row cell — same shape as StatCell above, but shows total spend as a % of total budget
// (with the underlying amounts as its caption) rather than a single trend delta, so it isn't
// built from StatCell directly.
function BudgetProgressCell({ spent, budgeted, total, emptyLabel }: {
  spent: number; budgeted: number; total: number; emptyLabel: string;
}) {
  const { fmt } = useAmountFormatter();
  const pct = total > 0 && budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const tier = spendTier(pct);

  return (
    <div className="flex-1 min-w-[112px] px-3.5 py-3.5 sm:px-4" data-testid="budget-progress-tile">
      <div className="flex items-center gap-1.5 mb-1.5">
        <FlatIcon icon={Target} tone="orange" size="xs" />
        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide truncate">Budget used</p>
      </div>
      <p data-testid="budget-progress-caption" className={cn(
        "text-[15px] sm:text-base font-bold tabular-nums tracking-tight leading-none",
        total > 0 ? TIER_CAPTION[tier] : "text-foreground"
      )}>
        {total > 0 ? `${Math.round(pct)}%` : "—"}
      </p>
      <p className="text-[10.5px] font-semibold text-muted-foreground mt-1.5 truncate">
        {total > 0 ? `${fmt(spent)} of ${fmt(budgeted)}` : emptyLabel}
      </p>
    </div>
  );
}

export function StatOverview({
  viewMode, investments,
  income, expenses, savingsRate, prevSavingsRate,
  incomeTrend, expenseTrend,
  ytdIncome, ytdExpenses, ytdIncomeTrend, ytdExpenseTrend, ytdSavingsRate, ytdSavingsRateTrend,
  monthlyBudgets, yearlyBudgets, isLoading,
}: StatOverviewProps) {
  const { fmt } = useAmountFormatter();
  const isYear = viewMode === "year";
  const active = useMemo(() => investments.filter(i => i.status === "ACTIVE"), [investments]);
  const invested = useMemo(() => active.reduce((s, i) => s + i.investedAmount, 0), [active]);
  const current  = useMemo(() => active.reduce((s, i) => s + i.currentValue,   0), [active]);
  const invGainPct = invested > 0 ? ((current - invested) / invested) * 100 : undefined;

  const srPct = pctChange(savingsRate, prevSavingsRate);

  // Budget Progress follows the Month/Year toggle like every other tile here — Month sums only
  // monthly budgets, Year sums only yearly ones, so switching the toggle visibly changes the
  // figure instead of showing an identical number regardless of which period is selected.
  const activeBudgets = isYear ? yearlyBudgets : monthlyBudgets;
  const budgetTotal    = activeBudgets.length;
  const budgetSpent    = activeBudgets.reduce((s, b) => s + b.spent, 0);
  const budgetBudgeted = activeBudgets.reduce((s, b) => s + b.budgeted, 0);

  if (isLoading) {
    return (
      <div className="flex overflow-x-auto no-scrollbar border-t border-border/60 divide-x divide-border/60">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 min-w-[112px] px-3.5 py-3.5 sm:px-4 space-y-2.5">
            <div className="w-6 h-6 rounded-lg shimmer" />
            <div className="h-4 w-16 rounded-lg shimmer" />
            <div className="h-2.5 w-12 rounded shimmer" />
          </div>
        ))}
      </div>
    );
  }

  const displayIncome     = isYear ? ytdIncome     : income;
  const displayExpenses   = isYear ? ytdExpenses   : expenses;
  const displaySavingsRate = isYear ? ytdSavingsRate : savingsRate;
  const incomeDeltaPct    = isYear ? ytdIncomeTrend  : incomeTrend;
  const expenseDeltaPct   = isYear ? ytdExpenseTrend : expenseTrend;
  const savingsRateDeltaPct = isYear ? ytdSavingsRateTrend : srPct;

  return (
    <div className="flex overflow-x-auto no-scrollbar border-t border-border/60 divide-x divide-border/60">
      <StatCell
        icon={TrendingUp} tone="purple"
        label="Investments" value={fmt(current)}
        deltaText={formatTrendDelta(invGainPct, "overall return")}
        deltaGood={invGainPct != null ? invGainPct >= 0 : undefined}
      />
      <StatCell
        icon={Banknote} tone="green"
        label={isYear ? "YTD Income" : "Income"} value={displayIncome != null ? fmt(displayIncome) : "—"}
        deltaText={isYear ? formatTrendDelta(incomeDeltaPct, "vs last year") : formatTrendDelta(incomeDeltaPct)}
        deltaGood={incomeDeltaPct != null ? incomeDeltaPct >= 0 : undefined}
      />
      <StatCell
        icon={Receipt} tone="red"
        label={isYear ? "YTD Expenses" : "Expenses"} value={displayExpenses != null ? fmt(displayExpenses) : "—"}
        deltaText={isYear ? formatTrendDelta(expenseDeltaPct, "vs last year") : formatTrendDelta(expenseDeltaPct)}
        deltaGood={expenseDeltaPct != null ? expenseDeltaPct <= 0 : undefined}
      />
      <StatCell
        icon={PiggyBank} tone="yellow"
        label="Savings rate"
        value={displaySavingsRate != null && displayIncome ? `${displaySavingsRate.toFixed(1)}%` : "—"}
        deltaText={isYear ? formatTrendDelta(savingsRateDeltaPct, "vs last year") : formatTrendDelta(savingsRateDeltaPct)}
        deltaGood={savingsRateDeltaPct != null ? savingsRateDeltaPct >= 0 : undefined}
      />
      <BudgetProgressCell spent={budgetSpent} budgeted={budgetBudgeted} total={budgetTotal}
        emptyLabel={isYear ? "No yearly budgets set" : "No monthly budgets set"} />
    </div>
  );
}
