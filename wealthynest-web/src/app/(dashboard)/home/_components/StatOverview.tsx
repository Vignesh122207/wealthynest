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
import {CHART_COLORS} from "@/lib/chartColors";
import {type IconTone, PremiumIcon} from "@/components/icons/PremiumIcon";
import type {NetWorthHistoryPoint} from "@/features/networth/types/networth.types";
import type {Investment} from "@/features/investments/types/investment.types";
import type {BudgetSummary} from "@/features/dashboard/types/dashboard.types";

interface StatOverviewProps {
  viewMode:          "month" | "year";
  netWorth:          number | undefined;
  prevNetWorth:      number | undefined;
  netWorthHistory:   NetWorthHistoryPoint[];
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

// ── Minimal inline sparkline — cheap, decorative, no need for a full Recharts instance ──
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const w = 64, h = 24;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface TileProps {
  icon: LucideIcon; tone: IconTone;
  label: string; value: string;
  deltaText?: string; deltaGood?: boolean;
  sparkColor?: string; sparkValues?: number[];
  delay?: string;
}

function StatTile({ icon, tone, label, value, deltaText, deltaGood, sparkColor, sparkValues, delay = "delay-0" }: TileProps) {
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
      <div className="flex items-center justify-between gap-2">
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
        {sparkValues && sparkColor && <Sparkline values={sparkValues} color={sparkColor} />}
      </div>
    </div>
  );
}

// ── Budget Progress — a ring instead of plain text, showing budgets on track out of total ──
function BudgetProgressTile({ onTrack, total, alertBannerVisible, secondaryCaption, delay = "delay-375" }: {
  onTrack: number; total: number; alertBannerVisible: boolean; secondaryCaption?: string; delay?: string;
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
          {secondaryCaption && (
            <p className="text-[10px] text-muted-foreground mt-1">{secondaryCaption}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatOverview({
  viewMode, netWorth, prevNetWorth, netWorthHistory, netWorthSinceJanTrend, investments,
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

  const nwSpark = netWorthHistory.slice(-6).map(p => p.netWorth);

  // Budget Progress shows whichever budget-type set matches the currently-browsed period —
  // Month mode's monthly budgets, Year mode's yearly ones (e.g. an annual sinking fund) — rather
  // than re-showing the same monthly ring under a relabeled title. The other set doesn't
  // disappear in Year mode, it demotes to the small caption under the ring (secondaryCaption).
  const activeBudgets   = isYear ? yearlyBudgets : monthlyBudgets;
  const budgetTotal     = activeBudgets.length;
  const budgetOverCount = activeBudgets.filter(b => b.overBudget).length;
  const budgetOnTrack   = budgetTotal - budgetOverCount;
  const monthlyOnTrack  = monthlyBudgets.filter(b => !b.overBudget).length;
  const secondaryCaption = isYear && monthlyBudgets.length > 0
    ? `${monthlyOnTrack} monthly budget${monthlyOnTrack !== 1 ? "s" : ""} also on track`
    : undefined;

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
        sparkColor={CHART_COLORS.primary} sparkValues={nwSpark}
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
        secondaryCaption={secondaryCaption} delay="delay-375" />
    </div>
  );
}
