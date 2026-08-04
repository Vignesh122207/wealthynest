"use client";

import {useMemo} from "react";
import {
    AlertTriangle,
    Banknote,
    CheckCircle2,
    Landmark,
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

interface StatOverviewProps {
  viewMode:          "month" | "year";
  netWorth:          number | undefined;
  prevNetWorth:      number | undefined;
  netWorthSinceJanTrend: number | undefined;
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
  alertBannerVisible: boolean;
  isLoading:         boolean;
}

interface TileProps {
  icon: LucideIcon; tone: IconTone;
  label: string; value: string;
  deltaText?: string; deltaGood?: boolean;
  delay?: string;
}

function StatTile({ icon, tone, label, value, deltaText, deltaGood, delay = "delay-0" }: TileProps) {
  return (
    <div className={cn(
      "bg-card rounded-2xl p-4 shadow-sm border border-border/50 card-hover animate-fade-in-up",
      delay
    )}>
      <div className="flex items-center gap-2 mb-3">
        <PremiumIcon icon={icon} tone={tone} size="sm" />
        <p className="text-xs font-semibold text-muted-foreground/80 truncate">{label}</p>
      </div>
      <p className="text-xl font-bold text-foreground tabular-nums tracking-tight leading-none mb-2">{value}</p>
      {deltaText ? (
        <p className={cn(
          "text-[11px] font-semibold tabular-nums",
          deltaGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
        )}>
          {deltaText}
        </p>
      ) : (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">New</span>
      )}
    </div>
  );
}

// ── Budget Progress — a ring instead of plain text, showing budgets on track out of total ──
function BudgetProgressTile({ onTrack, total, alertBannerVisible, delay = "delay-375" }: {
  onTrack: number; total: number; alertBannerVisible: boolean; delay?: string;
}) {
  const overCount = total - onTrack;
  const good = total > 0 && overCount === 0;
  // The SmartAlerts banner already says "You have N budgets over limit" right above
  // this row when it's visible — don't repeat the same sentence in the same breath.
  // The ring's red/green color still tells the story on its own either way.
  const suppressCaption = !good && total > 0 && alertBannerVisible;
  const pct = total > 0 ? (onTrack / total) * 100 : 0;
  const ringColor = total === 0 ? "hsl(var(--muted-foreground))" : good ? "#10b981" : "#ef4444";
  const r = 19, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className={cn("bg-card rounded-2xl p-4 shadow-sm border border-border/50 card-hover animate-fade-in-up", delay)}>
      <div className="flex items-center gap-2 mb-3">
        <PremiumIcon icon={Target} tone="orange" size="sm" />
        <p className="text-xs font-semibold text-muted-foreground/80 truncate">Budget Progress</p>
      </div>
      <div className="flex items-center gap-3" data-testid="budget-progress-tile">
        <div className="relative w-14 h-14 shrink-0">
          {total > 0 && (
            <div
              className="absolute inset-0.5 rounded-full blur-sm opacity-25"
              style={{ backgroundColor: ringColor }}
              aria-hidden
            />
          )}
          <svg width="56" height="56" viewBox="0 0 56 56" className="relative" style={{ transform: "rotate(-90deg)" }} aria-hidden>
            <circle cx="28" cy="28" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={4.5} />
            {total > 0 && (
              <circle cx="28" cy="28" r={r} fill="none" stroke={ringColor} strokeWidth={4.5} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1s ease" }} />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-foreground tabular-nums tracking-tight">{total > 0 ? onTrack : "—"}</span>
          </div>
        </div>
        <div className="min-w-0">
          <p data-testid="budget-progress-caption" className="text-lg font-bold text-foreground tabular-nums tracking-tight leading-none">
            {total > 0 ? `${onTrack} of ${total}` : "—"}
          </p>
          {!suppressCaption && (
            <p className={cn(
              "flex items-center gap-1 text-[11px] font-semibold mt-1.5",
              total === 0 ? "text-muted-foreground" : good ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
            )}>
              {total > 0 && (good
                ? <CheckCircle2 className="w-3 h-3 shrink-0" />
                : <AlertTriangle className="w-3 h-3 shrink-0" />)}
              {total === 0 ? "No budgets yet" : good ? "All on track" : `${overCount} over limit`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatOverview({
  viewMode, netWorth, prevNetWorth, netWorthSinceJanTrend, investments,
  income, expenses, savingsRate, prevSavingsRate,
  incomeTrend, expenseTrend,
  ytdIncome, ytdExpenses, ytdIncomeTrend, ytdExpenseTrend, ytdSavingsRate, ytdSavingsRateTrend,
  monthlyBudgets, yearlyBudgets, alertBannerVisible, isLoading,
}: StatOverviewProps) {
  const { fmt } = useAmountFormatter();
  const isYear = viewMode === "year";
  const active = useMemo(() => investments.filter(i => i.active), [investments]);
  const invested = useMemo(() => active.reduce((s, i) => s + i.investedAmount, 0), [active]);
  const current  = useMemo(() => active.reduce((s, i) => s + i.currentValue,   0), [active]);
  const invGainPct = invested > 0 ? ((current - invested) / invested) * 100 : undefined;

  const nwPct = pctChange(netWorth, prevNetWorth);
  const srPct = pctChange(savingsRate, prevSavingsRate);

  // Budget Progress always combines the browsed month's monthly budgets with the browsed
  // year's yearly budgets into one "N of N" figure — a budget's on-track status isn't a
  // monthly-vs-YTD figure the way income/expenses are, so unlike the tiles above it doesn't
  // change with the Month/Year toggle. A budget counts as over if it's over its own current
  // period (overBudget — e.g. blew this month's limit) OR over its annual pace (paceOverBudget
  // — e.g. running over across the year even though this one month looks fine on its own).
  // Pace alone would miss "over this month" whenever prior months had enough slack to keep the
  // YTD total under the pro-rated cap; overBudget alone would miss a bad multi-month trend that
  // never quite breaches any single month. See AnalyticsServiceImpl#getDashboard's comment.
  const activeBudgets   = [...monthlyBudgets, ...yearlyBudgets];
  const budgetTotal     = activeBudgets.length;
  const budgetOverCount = activeBudgets.filter(b => b.overBudget || b.paceOverBudget).length;
  const budgetOnTrack   = budgetTotal - budgetOverCount;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 space-y-3">
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatTile
        icon={Landmark} tone="blue"
        label="Net Worth" value={netWorth != null ? fmt(netWorth) : "—"}
        deltaText={isYear ? formatTrendDelta(netWorthSinceJanTrend, "since Jan 1") : formatTrendDelta(nwPct)}
        deltaGood={(isYear ? netWorthSinceJanTrend : nwPct) != null ? (isYear ? netWorthSinceJanTrend! : nwPct!) >= 0 : undefined}
        delay="delay-0"
      />
      <StatTile
        icon={TrendingUp} tone="purple"
        label="Investments" value={fmt(current)}
        deltaText={formatTrendDelta(invGainPct, "overall return")}
        deltaGood={invGainPct != null ? invGainPct >= 0 : undefined}
        delay="delay-75"
      />
      <StatTile
        icon={Banknote} tone="green"
        label={isYear ? "YTD Income" : "Monthly Income"} value={displayIncome != null ? fmt(displayIncome) : "—"}
        deltaText={isYear ? formatTrendDelta(incomeDeltaPct, "vs same period last year") : formatTrendDelta(incomeDeltaPct)}
        deltaGood={incomeDeltaPct != null ? incomeDeltaPct >= 0 : undefined}
        delay="delay-150"
      />
      <StatTile
        icon={Receipt} tone="red"
        label={isYear ? "YTD Expenses" : "Monthly Expenses"} value={displayExpenses != null ? fmt(displayExpenses) : "—"}
        deltaText={isYear ? formatTrendDelta(expenseDeltaPct, "vs same period last year") : formatTrendDelta(expenseDeltaPct)}
        deltaGood={expenseDeltaPct != null ? expenseDeltaPct <= 0 : undefined}
        delay="delay-225"
      />
      <StatTile
        icon={PiggyBank} tone="yellow"
        label={isYear ? "Savings Rate (YTD)" : "Savings Rate"}
        value={displaySavingsRate != null && displayIncome ? `${displaySavingsRate.toFixed(1)}%` : "—"}
        deltaText={isYear ? formatTrendDelta(savingsRateDeltaPct, "vs last year") : formatTrendDelta(savingsRateDeltaPct)}
        deltaGood={savingsRateDeltaPct != null ? savingsRateDeltaPct >= 0 : undefined}
        delay="delay-300"
      />
      <BudgetProgressTile onTrack={budgetOnTrack} total={budgetTotal} alertBannerVisible={alertBannerVisible}
        delay="delay-375" />
    </div>
  );
}
