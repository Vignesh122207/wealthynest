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
import {type IconTone, PremiumIcon} from "@/components/icons/PremiumIcon";
import type {Investment} from "@/features/investments/types/investment.types";
import type {BudgetSummary} from "@/features/dashboard/types/dashboard.types";

// Net Worth no longer lives in this grid — it's the page's own hero (see NetWorthHero.tsx), pulled
// out so the most important number on Home doesn't compete for attention against five same-shaped
// tiles. Everything left here is genuinely secondary, equal-weight context.
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
  /** Overrides the default text-foreground value color — Budget Used only, so its status tier
   * (green/amber/red) reads from the number itself, matching BudgetSection's own per-category rows
   * (colored %, neutral amount caption) instead of stacking a second colored line on top of an
   * already status-tinted card. */
  valueColorClass?: string;
  /** Budget Used only — a soft status tint (e.g. "bg-amber-500/10") replacing the plain card
   * background once usage crosses into amber/red territory, so the card itself flags the alert
   * instead of only the number inside it. */
  bgTintClass?: string;
  valueTestId?: string; deltaTestId?: string;
  delay?: string;
}

function StatTile({ icon, tone, label, value, deltaText, deltaGood, valueColorClass, bgTintClass, valueTestId, deltaTestId, delay = "delay-0" }: TileProps) {
  return (
    <div className={cn(
      "rounded-2xl p-3.5 card-hover animate-fade-in-up",
      bgTintClass ?? "bg-card", "border border-slate-100/80 dark:border-border/50 shadow-soft dark:shadow-none",
      delay
    )}>
      <div className="flex items-center gap-2 mb-3">
        <PremiumIcon icon={icon} tone={tone} size="sm" />
        <p className="text-xs font-semibold text-muted-foreground/80 truncate">{label}</p>
      </div>
      <p data-testid={valueTestId} className={cn(
        "text-xl font-bold tabular-nums tracking-tight leading-none mb-2",
        valueColorClass ?? "text-foreground"
      )}>{value}</p>
      {deltaText ? (
        <p data-testid={deltaTestId} className={cn(
          "text-xs font-medium tabular-nums truncate",
          // undefined deltaGood (Budget Used's spent/budgeted caption — its own status already
          // reads from the colored value above) stays neutral rather than defaulting to red.
          deltaGood == null ? "text-muted-foreground/80" : deltaGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
        )}>
          {deltaText}
        </p>
      ) : (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">New</span>
      )}
    </div>
  );
}

// Same tier scale BudgetSection.tsx uses per-category (>80% amber, over budget red) — pct here
// is USED (spent/budgeted), so unlike a plain progress bar, higher is worse.
type BudgetTier = "green" | "amber" | "red";
function usedTier(pct: number): BudgetTier {
  if (pct > 100) return "red";
  if (pct > 80) return "amber";
  return "green";
}
const TIER_VALUE_COLOR: Record<BudgetTier, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red:   "text-red-500 dark:text-red-400",
};
// Soft translucent status tint for the card itself, not just its text — amber once past 80% used,
// shifting to a warmer red/coral once actually over budget, so the card visually flags the alert
// at a glance instead of requiring you to read the number. Translucent (not a solid hex fill) so
// it sits correctly over both --card tones without a separate dark-mode value.
const TIER_BG: Partial<Record<BudgetTier, string>> = {
  amber: "bg-amber-500/10",
  red:   "bg-red-500/10",
};

// ── Budget Used — reuses StatTile so it stays pixel-aligned with every other tile ──
function BudgetUsedTile({ spent, budgeted, total, emptyLabel, fmt, delay = "delay-300" }: {
  spent: number; budgeted: number; total: number; emptyLabel: string;
  fmt: (amount: number) => string; delay?: string;
}) {
  const pct  = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const tier = usedTier(pct);

  return (
    <StatTile
      icon={Target} tone="orange" label="Budget Used"
      value={total > 0 ? `${Math.round(pct)}%` : "—"}
      valueColorClass={total > 0 ? TIER_VALUE_COLOR[tier] : undefined}
      deltaText={total > 0 ? `${fmt(spent)} of ${fmt(budgeted)}` : emptyLabel}
      bgTintClass={total > 0 ? TIER_BG[tier] : undefined}
      valueTestId="budget-progress-tile" deltaTestId="budget-progress-caption"
      delay={delay}
    />
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

  // Budget Used follows the Month/Year toggle like every other tile here — Month sums only
  // monthly budgets, Year sums only yearly ones, so switching the toggle visibly changes the
  // spent/budgeted totals instead of showing identical figures regardless of which period is selected.
  const activeBudgets  = isYear ? yearlyBudgets : monthlyBudgets;
  const budgetTotal    = activeBudgets.length;
  const budgetSpent    = activeBudgets.reduce((s, b) => s + b.spent, 0);
  const budgetBudgeted = activeBudgets.reduce((s, b) => s + b.budgeted, 0);

  // [&>*]:min-w-0 — see TwoColRow's identical comment: without it, a large formatted currency value
  // (grid items default to min-width:auto) can push a tile — and the row — wider than its track
  // instead of the tile's own truncate/tabular-nums layout containing it.
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 [&>*]:min-w-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-3.5 space-y-3 bg-card border border-slate-100/80 dark:border-border/50 shadow-soft dark:shadow-none">
            <div className="w-8 h-8 rounded-xl shimmer" />
            <div className="h-6 w-24 rounded-lg shimmer" />
            <div className="h-3 w-16 rounded shimmer" />
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 [&>*]:min-w-0">
      <StatTile
        icon={TrendingUp} tone="purple"
        label="Investments" value={fmt(current)}
        deltaText={formatTrendDelta(invGainPct, "overall return")}
        deltaGood={invGainPct != null ? invGainPct >= 0 : undefined}
        delay="delay-0"
      />
      <StatTile
        icon={Banknote} tone="green"
        label={isYear ? "YTD Income" : "Monthly Income"} value={displayIncome != null ? fmt(displayIncome) : "—"}
        deltaText={isYear ? formatTrendDelta(incomeDeltaPct, "vs same period last year") : formatTrendDelta(incomeDeltaPct)}
        deltaGood={incomeDeltaPct != null ? incomeDeltaPct >= 0 : undefined}
        delay="delay-75"
      />
      <StatTile
        icon={Receipt} tone="red"
        label={isYear ? "YTD Expenses" : "Monthly Expenses"} value={displayExpenses != null ? fmt(displayExpenses) : "—"}
        deltaText={isYear ? formatTrendDelta(expenseDeltaPct, "vs same period last year") : formatTrendDelta(expenseDeltaPct)}
        deltaGood={expenseDeltaPct != null ? expenseDeltaPct <= 0 : undefined}
        delay="delay-150"
      />
      <StatTile
        icon={PiggyBank} tone="yellow"
        label={isYear ? "Savings Rate (YTD)" : "Savings Rate"}
        value={displaySavingsRate != null && displayIncome ? `${displaySavingsRate.toFixed(1)}%` : "—"}
        deltaText={isYear ? formatTrendDelta(savingsRateDeltaPct, "vs last year") : formatTrendDelta(savingsRateDeltaPct)}
        deltaGood={savingsRateDeltaPct != null ? savingsRateDeltaPct >= 0 : undefined}
        delay="delay-225"
      />
      <BudgetUsedTile spent={budgetSpent} budgeted={budgetBudgeted} total={budgetTotal}
        emptyLabel={isYear ? "No yearly budgets set" : "No monthly budgets set"}
        fmt={fmt} delay="delay-300" />
    </div>
  );
}
