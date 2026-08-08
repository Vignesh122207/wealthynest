"use client";

import {useMemo} from "react";
import {
    Banknote,
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
  isLoading:         boolean;
}

interface TileProps {
  icon: LucideIcon; tone: IconTone;
  label: string; value: string;
  deltaText?: string; deltaGood?: boolean;
  /** Overrides the deltaGood-derived green/red color — for tiles with a third (amber) state,
   * e.g. Budget Used's spent/budgeted line. Also switches that line back to full prominence (see
   * the deltaColorClass check below): unlike a plain trend blurb, this is the tile's own primary
   * reading, not a secondary metric to de-emphasize. */
  deltaColorClass?: string;
  /** Budget Used only — a soft status tint (e.g. "bg-amber-500/10") replacing the plain card
   * background once usage crosses into amber/red territory, so the card itself flags the alert
   * instead of only the number inside it. */
  bgTintClass?: string;
  valueTestId?: string; deltaTestId?: string;
  delay?: string;
  /** Net Worth alone — a soft primary-tinted card + a step-larger value, so it reads as the
   * dashboard's headline number at a glance while staying inside the same 6-up grid as every
   * other tile (same padding/radius/shadow/icon size — only the tint and value size differ). */
  primary?: boolean;
}

function StatTile({ icon, tone, label, value, deltaText, deltaGood, deltaColorClass, bgTintClass, valueTestId, deltaTestId, delay = "delay-0", primary }: TileProps) {
  return (
    <div className={cn(
      "rounded-2xl p-3.5 card-hover animate-fade-in-up",
      primary
        ? "bg-primary/[0.045] dark:bg-primary/[0.07] border border-primary/25 shadow-soft dark:shadow-none"
        : cn(bgTintClass ?? "bg-card", "border border-slate-100/80 dark:border-border/50 shadow-soft dark:shadow-none"),
      delay
    )}>
      <div className="flex items-center gap-2 mb-3">
        <PremiumIcon icon={icon} tone={tone} size="sm" />
        <p className="text-xs font-semibold text-muted-foreground/80 truncate">{label}</p>
      </div>
      <p data-testid={valueTestId} className={cn(
        "font-bold text-foreground tabular-nums tracking-tight leading-none mb-2",
        primary ? "text-2xl" : "text-xl"
      )}>{value}</p>
      {deltaText ? (
        <p data-testid={deltaTestId} className={cn(
          "tabular-nums truncate",
          // A plain trend blurb ("+2.3% vs last month") is secondary context — de-emphasized so
          // the value above it stays the tile's one clear focal point. Budget Used's spent/budgeted
          // line (the deltaColorClass branch) is the opposite: it's that tile's actual headline
          // reading, not a footnote, so it keeps full weight/opacity.
          deltaColorClass ? "text-[11px] font-semibold" : "text-[10px] font-medium opacity-75",
          deltaColorClass ?? (deltaGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")
        )}>
          {deltaText}
        </p>
      ) : (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">New</span>
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
const TIER_CAPTION: Record<BudgetTier, string> = {
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

// ── Budget Used — reuses StatTile so it stays pixel-aligned with every other hero tile ──
function BudgetUsedTile({ spent, budgeted, total, emptyLabel, fmt, delay = "delay-375" }: {
  spent: number; budgeted: number; total: number; emptyLabel: string;
  fmt: (amount: number) => string; delay?: string;
}) {
  const pct  = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const tier = usedTier(pct);

  return (
    <StatTile
      icon={Target} tone="orange" label="Budget Used"
      value={total > 0 ? `${Math.round(pct)}%` : "—"}
      deltaText={total > 0 ? `${fmt(spent)} of ${fmt(budgeted)}` : emptyLabel}
      deltaColorClass={total > 0 ? TIER_CAPTION[tier] : "text-muted-foreground"}
      bgTintClass={total > 0 ? TIER_BG[tier] : undefined}
      valueTestId="budget-progress-tile" deltaTestId="budget-progress-caption"
      delay={delay}
    />
  );
}

// ── Mobile hero — below `lg` (matches Sidebar/MobileNav's own desktop/mobile split), Net Worth
// becomes one headline card instead of an equal-weight grid tile, with the other five stats as a
// horizontal-scroll pill row underneath. Both this and the desktop grid below always render (class
// -toggled via `lg:hidden` / `hidden lg:grid`, same as Sidebar/MobileNav) so there's no viewport-
// width JS and no hydration flash.
interface PillProps {
  icon: LucideIcon; tone: IconTone;
  label: string; value: string;
  deltaText?: string; deltaGood?: boolean;
  deltaColorClass?: string;
  bgTintClass?: string;
  valueTestId?: string; deltaTestId?: string;
}

function HeroPill({ icon, tone, label, value, deltaText, deltaGood, deltaColorClass, bgTintClass, valueTestId, deltaTestId }: PillProps) {
  return (
    <div className={cn(
      "shrink-0 min-w-[132px] flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 border",
      bgTintClass ? cn(bgTintClass, "border-transparent") : "bg-card border-slate-100/80 dark:border-border/50"
    )}>
      <PremiumIcon icon={icon} tone={tone} size="xs" />
      <div className="leading-tight min-w-0">
        <p data-testid={valueTestId} className="text-[13px] font-bold text-foreground tabular-nums truncate">{value}</p>
        <p className="text-[10px] text-muted-foreground/80 truncate">{label}</p>
        {deltaText && (
          <p data-testid={deltaTestId} className={cn(
            "text-[9.5px] font-semibold tabular-nums truncate mt-0.5",
            deltaColorClass ?? (deltaGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")
          )}>
            {deltaText}
          </p>
        )}
      </div>
    </div>
  );
}

// Same tier logic as BudgetUsedTile, rendered as a pill instead of a grid box.
function BudgetUsedPill({ spent, budgeted, total, emptyLabel, fmt }: {
  spent: number; budgeted: number; total: number; emptyLabel: string; fmt: (amount: number) => string;
}) {
  const pct  = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const tier = usedTier(pct);

  return (
    <HeroPill
      icon={Target} tone="orange" label="Budget Used"
      value={total > 0 ? `${Math.round(pct)}%` : "—"}
      deltaText={total > 0 ? `${fmt(spent)} of ${fmt(budgeted)}` : emptyLabel}
      deltaColorClass={total > 0 ? TIER_CAPTION[tier] : "text-muted-foreground"}
      bgTintClass={total > 0 ? TIER_BG[tier] : undefined}
      valueTestId="budget-progress-pill" deltaTestId="budget-progress-pill-caption"
    />
  );
}

function StatHeroMobile({ value, deltaText, deltaGood, children }: {
  value: string; deltaText?: string; deltaGood?: boolean; children: React.ReactNode;
}) {
  return (
    <section
      aria-label="Financial overview"
      className="lg:hidden relative rounded-3xl overflow-hidden bg-primary/[0.045] dark:bg-primary/[0.07] border border-primary/25 shadow-soft dark:shadow-none px-4 pt-5 pb-4 animate-fade-in-up"
    >
      <div aria-hidden className="absolute -top-16 -left-10 w-56 h-56 rounded-full blur-3xl opacity-[0.14] bg-gradient-to-br from-blue-500 to-indigo-600 pointer-events-none" />
      <div className="relative">
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-1">Net worth</p>
        <p data-testid="net-worth-hero-value" className="text-4xl font-bold tabular-nums tracking-tight text-foreground leading-none mb-2">
          {value}
        </p>
        {deltaText && (
          <span data-testid="net-worth-hero-delta" className={cn(
            "inline-flex items-center text-[11.5px] font-bold px-2.5 py-1 rounded-full tabular-nums",
            deltaGood === false ? "bg-red-500/10 text-red-500 dark:text-red-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}>
            {deltaText}
          </span>
        )}
        {/* overflow-x-auto + edge mask, same pattern AccountsHero uses for its type-breakdown
            pills — scrolling (not reflowing columns) is what keeps this legible from a 320px
            phone up through tablet widths without a second breakpoint-specific layout. */}
        <div
          className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5 [mask-image:linear-gradient(to_right,black_92%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,black_92%,transparent_100%)]"
          style={{ scrollbarWidth: "none" }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export function StatOverview({
  viewMode, netWorth, prevNetWorth, netWorthSinceJanTrend, investments,
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

  const nwPct = pctChange(netWorth, prevNetWorth);
  const srPct = pctChange(savingsRate, prevSavingsRate);

  // Budget Used follows the Month/Year toggle like every other tile here — Month sums only
  // monthly budgets, Year sums only yearly ones, so switching the toggle visibly changes the
  // spent/budgeted totals instead of showing identical figures regardless of which period is selected.
  const activeBudgets  = isYear ? yearlyBudgets : monthlyBudgets;
  const budgetTotal    = activeBudgets.length;
  const budgetSpent    = activeBudgets.reduce((s, b) => s + b.spent, 0);
  const budgetBudgeted = activeBudgets.reduce((s, b) => s + b.budgeted, 0);

  // [&>*]:min-w-0 on the desktop grid below — see TwoColRow's identical comment: without it, a
  // large formatted currency value (grid items default to min-width:auto) can push a tile — and
  // the row — wider than its track instead of the tile's own truncate/tabular-nums layout
  // containing it.
  if (isLoading) {
    return (
      <>
        <section aria-hidden className="lg:hidden rounded-3xl border border-primary/25 bg-primary/[0.045] dark:bg-primary/[0.07] px-4 pt-5 pb-4 space-y-3">
          <div className="w-24 h-3 rounded shimmer" />
          <div className="w-40 h-9 rounded-lg shimmer" />
          <div className="w-28 h-6 rounded-full shimmer" />
          <div className="flex gap-2 pt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[132px] h-[58px] rounded-2xl shimmer" />
            ))}
          </div>
        </section>

        <div className="hidden lg:grid grid-cols-6 gap-3 [&>*]:min-w-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn(
              "rounded-2xl p-3.5 space-y-3",
              i === 0
                ? "bg-primary/[0.045] dark:bg-primary/[0.07] border border-primary/25 shadow-soft dark:shadow-none"
                : "bg-card border border-slate-100/80 dark:border-border/50 shadow-soft dark:shadow-none"
            )}>
              <div className="w-8 h-8 rounded-xl shimmer" />
              <div className={cn("rounded-lg shimmer", i === 0 ? "h-7 w-28" : "h-6 w-24")} />
              <div className="h-3 w-16 rounded shimmer" />
            </div>
          ))}
        </div>
      </>
    );
  }

  const displayIncome     = isYear ? ytdIncome     : income;
  const displayExpenses   = isYear ? ytdExpenses   : expenses;
  const displaySavingsRate = isYear ? ytdSavingsRate : savingsRate;
  const incomeDeltaPct    = isYear ? ytdIncomeTrend  : incomeTrend;
  const expenseDeltaPct   = isYear ? ytdExpenseTrend : expenseTrend;
  const savingsRateDeltaPct = isYear ? ytdSavingsRateTrend : srPct;

  const netWorthDeltaText = isYear ? formatTrendDelta(netWorthSinceJanTrend, "since Jan 1") : formatTrendDelta(nwPct);
  const netWorthDeltaGood = (isYear ? netWorthSinceJanTrend : nwPct) != null ? (isYear ? netWorthSinceJanTrend! : nwPct!) >= 0 : undefined;

  return (
    <>
      <StatHeroMobile
        value={netWorth != null ? fmt(netWorth) : "—"}
        deltaText={netWorthDeltaText}
        deltaGood={netWorthDeltaGood}
      >
        <HeroPill
          icon={TrendingUp} tone="purple"
          label="Investments" value={fmt(current)}
          deltaText={formatTrendDelta(invGainPct, "overall return")}
          deltaGood={invGainPct != null ? invGainPct >= 0 : undefined}
        />
        <HeroPill
          icon={Banknote} tone="green"
          label={isYear ? "YTD Income" : "Monthly Income"} value={displayIncome != null ? fmt(displayIncome) : "—"}
          deltaText={isYear ? formatTrendDelta(incomeDeltaPct, "vs same period last year") : formatTrendDelta(incomeDeltaPct)}
          deltaGood={incomeDeltaPct != null ? incomeDeltaPct >= 0 : undefined}
        />
        <HeroPill
          icon={Receipt} tone="red"
          label={isYear ? "YTD Expenses" : "Monthly Expenses"} value={displayExpenses != null ? fmt(displayExpenses) : "—"}
          deltaText={isYear ? formatTrendDelta(expenseDeltaPct, "vs same period last year") : formatTrendDelta(expenseDeltaPct)}
          deltaGood={expenseDeltaPct != null ? expenseDeltaPct <= 0 : undefined}
        />
        <HeroPill
          icon={PiggyBank} tone="yellow"
          label={isYear ? "Savings Rate (YTD)" : "Savings Rate"}
          value={displaySavingsRate != null && displayIncome ? `${displaySavingsRate.toFixed(1)}%` : "—"}
          deltaText={isYear ? formatTrendDelta(savingsRateDeltaPct, "vs last year") : formatTrendDelta(savingsRateDeltaPct)}
          deltaGood={savingsRateDeltaPct != null ? savingsRateDeltaPct >= 0 : undefined}
        />
        <BudgetUsedPill spent={budgetSpent} budgeted={budgetBudgeted} total={budgetTotal}
          emptyLabel={isYear ? "No yearly budgets set" : "No monthly budgets set"} fmt={fmt} />
      </StatHeroMobile>

      <div className="hidden lg:grid grid-cols-6 gap-3 [&>*]:min-w-0">
        <StatTile
          icon={Landmark} tone="blue"
          label="Net Worth" value={netWorth != null ? fmt(netWorth) : "—"}
          deltaText={netWorthDeltaText}
          deltaGood={netWorthDeltaGood}
          delay="delay-0"
          primary
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
        <BudgetUsedTile spent={budgetSpent} budgeted={budgetBudgeted} total={budgetTotal}
          emptyLabel={isYear ? "No yearly budgets set" : "No monthly budgets set"}
          fmt={fmt} delay="delay-375" />
      </div>
    </>
  );
}
