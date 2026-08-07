"use client";

import {useMemo} from "react";
import Link from "next/link";
import {Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipValueType} from "recharts";
import {ArrowDownRight, ArrowUpRight, TrendingUp, Wallet} from "lucide-react";
import {chartValueToNumber, cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {CHART_COLORS} from "@/lib/chartColors";
import {type IconTone, PremiumIcon} from "@/components/icons/PremiumIcon";
import {StockLogo} from "@/components/icons/StockLogo";
import {FundLogo} from "@/components/icons/FundLogo";
import {BankLogo} from "@/components/icons/BankLogo";
import {EmptyState} from "@/components/shared/EmptyState";
import {INVESTMENT_TYPE_META} from "@/lib/investmentTypeMeta";
import type {Investment, InvestmentType} from "@/features/investments/types/investment.types";

interface InvestmentPanelProps {
  investments: Investment[];
  chart: {
    tooltipStyle: React.CSSProperties;
    labelStyle:   React.CSSProperties;
    itemStyle:    React.CSSProperties;
  };
  isLoading: boolean;
}

type Bucket = "Equity" | "Debt" | "Gold" | "Other";

const BUCKET_BY_TYPE: Record<InvestmentType, Bucket> = {
  STOCK: "Equity", MUTUAL_FUND: "Equity", REIT: "Equity",
  BOND: "Debt", FD: "Debt", PPF: "Debt", NPS: "Debt",
  GOLD: "Gold", GOLD_ETF: "Gold",
  OTHER: "Other",
};

const BUCKET_COLOR: Record<Bucket, string> = {
  Equity: CHART_COLORS.income,
  Debt:   CHART_COLORS.primary,
  Gold:   CHART_COLORS.warning,
  Other:  CHART_COLORS.neutral,
};

function holdingName(inv: Investment): string {
  return inv.companyName || inv.symbol || inv.bankName || inv.investmentType.replace(/_/g, " ");
}

export function InvestmentPanel({ investments, chart, isLoading }: InvestmentPanelProps) {
  const { fmt, fmtC } = useAmountFormatter();
  const active = useMemo(() => investments.filter(i => i.status === "ACTIVE"), [investments]);

  // Mirrors the Investments page's own OverviewTab computation exactly (sum
  // investedAmount/currentValue across every holding — stocks, bonds, FD, gold,
  // everything). The dashboard-summary endpoint's totals were only reflecting
  // stocks, so we compute directly from the same investments list here instead
  // of trusting that endpoint's aggregate fields.
  const totalInvested = useMemo(() => active.reduce((s, i) => s + i.investedAmount, 0), [active]);
  const totalCurrent  = useMemo(() => active.reduce((s, i) => s + i.currentValue,   0), [active]);
  const gainLoss = totalCurrent - totalInvested;
  const gainPct  = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;
  const isGain   = gainLoss >= 0;

  const allocation = useMemo(() => {
    const byBucket = new Map<Bucket, number>();
    for (const inv of active) {
      const bucket = BUCKET_BY_TYPE[inv.investmentType] ?? "Other";
      byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + inv.currentValue);
    }
    const total = [...byBucket.values()].reduce((s, v) => s + v, 0);
    return [...byBucket.entries()]
      .map(([bucket, value]) => ({ bucket, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [active]);

  const topHoldings = useMemo(
    () => [...active].sort((a, b) => b.currentValue - a.currentValue).slice(0, 3),
    [active]
  );

  const summaryStats = [
    {
      key: "invested",
      label: "Invested",
      value: fmt(totalInvested),
      icon: Wallet,
      tone: "gray" as IconTone,
      valueColor: "text-foreground",
    },
    {
      key: "current",
      label: "Current Value",
      value: fmt(totalCurrent),
      icon: TrendingUp,
      tone: "teal" as IconTone,
      valueColor: "text-primary",
    },
    {
      key: "gain",
      label: "Gain / Loss",
      value: fmt(gainLoss),
      icon: isGain ? ArrowUpRight : ArrowDownRight,
      tone: (isGain ? "green" : "red") as IconTone,
      valueColor: isGain ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
      sub: `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`,
    },
  ];

  return (
    <div className="bg-card rounded-2xl border border-slate-100/80 dark:border-border/50 shadow-soft dark:shadow-none p-4 animate-fade-in-up card-hover">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-foreground text-sm">Investment Overview</h2>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">Portfolio performance</p>
        </div>
        <Link href="/investments"
          className="text-xs font-semibold text-primary hover:underline transition-colors">
          View all →
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-5">
          <div className="h-[120px] rounded-2xl shimmer" />
          <div className="grid sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl shimmer" />)}
          </div>
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No investments yet"
          description="Track stocks, mutual funds, gold, and more to see your portfolio here."
          action={<Link href="/investments" className="text-xs font-semibold text-primary hover:underline">Add an investment →</Link>}
        />
      ) : (
      <>
      {allocation.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          {/* Allocation donut */}
          <div className="flex items-center gap-4">
            {/* accessibilityLayer={false} on the chart handles the outer <svg role="application">
                (see SixMonthTrend.tsx's identical wrapper), but <Pie> independently puts its own
                tabindex="0" on its rendered <g class="recharts-pie"> layer for slice-level keyboard
                nav — a second, separate focusable element inside this same aria-hidden div. That
                layer reads its own `rootTabIndex` prop (default 0), not `tabIndex` — passing
                tabIndex={-1} here is a no-op since <Pie> doesn't forward an unrecognized prop;
                confirmed still failing axe in CI with rootTabIndex still defaulted to 0. */}
            <div className="w-[120px] h-[120px] sm:w-[100px] sm:h-[100px] shrink-0" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer={false}>
                  <Pie data={allocation} cx="50%" cy="50%" innerRadius={32} outerRadius={48}
                    paddingAngle={3} dataKey="value" strokeWidth={0} rootTabIndex={-1}>
                    {allocation.map((a) => <Cell key={a.bucket} fill={BUCKET_COLOR[a.bucket]} />)}
                  </Pie>
                  <Tooltip contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                    formatter={(v: TooltipValueType | undefined, _n: number | string | undefined, props: { payload?: { bucket?: string } }) => [fmt(chartValueToNumber(v)), props.payload?.bucket ?? "Value"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 min-w-0">
              {allocation.map((a) => (
                <div key={a.bucket} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: BUCKET_COLOR[a.bucket] }} />
                  <span className="text-muted-foreground">{a.bucket}</span>
                  <span className="font-semibold text-foreground tabular-nums ml-auto">{a.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top holdings */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">Top Holdings</p>
            <div className="divide-y divide-slate-100/80 dark:divide-border/40">
              {topHoldings.map((h) => (
                <div key={h.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 text-xs">
                  {h.investmentType === "STOCK" ? (
                    <StockLogo symbol={h.symbol} fallbackIcon={INVESTMENT_TYPE_META[h.investmentType].icon} fallbackHex={INVESTMENT_TYPE_META[h.investmentType].hex} size="sm" className="shrink-0" />
                  ) : h.investmentType === "MUTUAL_FUND" ? (
                    <FundLogo companyName={h.companyName} fallbackIcon={INVESTMENT_TYPE_META[h.investmentType].icon} fallbackHex={INVESTMENT_TYPE_META[h.investmentType].hex} size="sm" className="shrink-0" />
                  ) : (h.investmentType === "BOND" || h.investmentType === "FD") ? (
                    <BankLogo name={h.bankName} fallbackIcon={INVESTMENT_TYPE_META[h.investmentType].icon} fallbackHex={INVESTMENT_TYPE_META[h.investmentType].hex} size="sm" className="shrink-0" />
                  ) : (
                    <PremiumIcon icon={INVESTMENT_TYPE_META[h.investmentType].icon} hex={INVESTMENT_TYPE_META[h.investmentType].hex} size="sm" className="shrink-0" />
                  )}
                  {/* Name + asset-class label — Top Holdings ranks by value across every
                      investment type, so a bank-logo row (FD/Bond) needs its type spelled out
                      to read distinctly from a stock/MF row using the same layout. */}
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground font-semibold truncate">{holdingName(h)}</p>
                    <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{INVESTMENT_TYPE_META[h.investmentType].label}</p>
                  </div>
                  <span className={cn(
                    "inline-flex items-center gap-1 shrink-0 pl-1.5 pr-2 py-1 rounded-full text-[11px] whitespace-nowrap",
                    h.gainLoss >= 0
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-500 dark:text-red-400"
                  )}>
                    {h.gainLoss >= 0
                      ? <ArrowUpRight className="w-3 h-3 shrink-0" strokeWidth={2.5} />
                      : <ArrowDownRight className="w-3 h-3 shrink-0" strokeWidth={2.5} />}
                    <span className="font-semibold tabular-nums">
                      {h.gainLoss >= 0 ? "+" : "-"}{fmtC(Math.abs(h.gainLoss))}
                    </span>
                    <span className="font-medium tabular-nums opacity-75">
                      {h.gainLossPct >= 0 ? "+" : ""}{h.gainLossPct.toFixed(1)}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer metrics — borderless grid columns, no boxed backgrounds */}
      <div className={cn(
        "grid grid-cols-3 gap-4",
        allocation.length > 0 && "pt-4 border-t border-slate-100/80 dark:border-border/40"
      )}>
        {summaryStats.map((s) => (
          <div key={s.key} className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <PremiumIcon icon={s.icon} tone={s.tone} size="xs" />
              <p className="text-[11px] text-muted-foreground font-medium truncate">{s.label}</p>
            </div>
            <p className={cn("text-sm sm:text-base font-bold tabular-nums truncate", s.valueColor)}>{s.value}</p>
            {s.sub && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}
