"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";
import { CHART_COLORS } from "@/lib/chartColors";
import { PremiumIcon, type IconTone } from "@/components/icons/PremiumIcon";
import { StockLogo } from "@/components/icons/StockLogo";
import { FundLogo } from "@/components/icons/FundLogo";
import { BankLogo } from "@/components/icons/BankLogo";
import { INVESTMENT_TYPE_META } from "@/lib/investmentTypeMeta";
import type { Investment, InvestmentType } from "@/features/investments/types/investment.types";

interface InvestmentPanelProps {
  investments: Investment[];
  chart: {
    tooltipStyle: React.CSSProperties;
    labelStyle:   React.CSSProperties;
    itemStyle:    React.CSSProperties;
  };
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

export function InvestmentPanel({ investments, chart }: InvestmentPanelProps) {
  const { fmt } = useAmountFormatter();
  const active = useMemo(() => investments.filter(i => i.active), [investments]);

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
    () => [...active].sort((a, b) => b.currentValue - a.currentValue).slice(0, 4),
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
      cardBg: "bg-muted/40",
    },
    {
      key: "current",
      label: "Current Value",
      value: fmt(totalCurrent),
      icon: TrendingUp,
      tone: "teal" as IconTone,
      valueColor: "text-primary",
      cardBg: "bg-primary/8",
    },
    {
      key: "gain",
      label: "Gain / Loss",
      value: fmt(gainLoss),
      icon: isGain ? ArrowUpRight : ArrowDownRight,
      tone: (isGain ? "green" : "red") as IconTone,
      valueColor: isGain ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
      cardBg: isGain ? "bg-emerald-500/8" : "bg-red-500/8",
      sub: `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`,
    },
  ];

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm animate-fade-in-up card-hover">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-foreground">Investment Overview</h3>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">Portfolio performance</p>
        </div>
        <Link href="/investments"
          className="text-xs font-semibold text-primary hover:underline transition-colors">
          View all →
        </Link>
      </div>

      {allocation.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          {/* Allocation donut */}
          <div className="flex items-center gap-4">
            <div className="w-[120px] h-[120px] sm:w-[100px] sm:h-[100px] shrink-0" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocation} cx="50%" cy="50%" innerRadius={32} outerRadius={48}
                    paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {allocation.map((a) => <Cell key={a.bucket} fill={BUCKET_COLOR[a.bucket]} />)}
                  </Pie>
                  <Tooltip contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                    formatter={(v: number, _n: string, props: { payload?: { bucket?: string } }) => [fmt(v), props.payload?.bucket ?? "Value"]} />
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
            {topHoldings.map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-xs">
                {h.investmentType === "STOCK" ? (
                  <StockLogo symbol={h.symbol} fallbackIcon={INVESTMENT_TYPE_META[h.investmentType].icon} fallbackHex={INVESTMENT_TYPE_META[h.investmentType].hex} size="xs" className="shrink-0" />
                ) : h.investmentType === "MUTUAL_FUND" ? (
                  <FundLogo companyName={h.companyName} fallbackIcon={INVESTMENT_TYPE_META[h.investmentType].icon} fallbackHex={INVESTMENT_TYPE_META[h.investmentType].hex} size="xs" className="shrink-0" />
                ) : (h.investmentType === "BOND" || h.investmentType === "FD") ? (
                  <BankLogo name={h.bankName} fallbackIcon={INVESTMENT_TYPE_META[h.investmentType].icon} fallbackHex={INVESTMENT_TYPE_META[h.investmentType].hex} size="xs" className="shrink-0" />
                ) : (
                  <PremiumIcon icon={INVESTMENT_TYPE_META[h.investmentType].icon} hex={INVESTMENT_TYPE_META[h.investmentType].hex} size="xs" className="shrink-0" />
                )}
                <span className="text-foreground font-medium truncate min-w-0 flex-1">{holdingName(h)}</span>
                <span className={cn(
                  "font-semibold tabular-nums shrink-0",
                  h.gainLossPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                )}>
                  {h.gainLossPct >= 0 ? "+" : ""}{h.gainLossPct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={cn(allocation.length > 0 && "pt-4 border-t border-border/40")}>
        {/* Mobile — compact grouped list */}
        <div className="sm:hidden rounded-2xl border border-border/30 divide-y divide-border/40 overflow-hidden">
          {summaryStats.map((s) => (
            <div key={s.key} className="flex items-center gap-3 px-4 py-3.5">
              <PremiumIcon icon={s.icon} tone={s.tone} size="sm" className="w-9 h-9" />
              <p className="text-xs text-muted-foreground font-medium flex-1">{s.label}</p>
              <div className="text-right shrink-0">
                <p className={cn("text-sm font-bold tabular-nums", s.valueColor)}>{s.value}</p>
                {s.sub && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{s.sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop — individual cards */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-3">
          {summaryStats.map((s) => (
            <div key={s.key} className={cn("rounded-2xl p-4 border border-border/30", s.cardBg)}>
              <div className="flex items-center gap-2 mb-2">
                <PremiumIcon icon={s.icon} tone={s.tone} size="xs" />
                <p className="text-xs text-muted-foreground/70 font-medium">{s.label}</p>
              </div>
              <div className={cn("text-base font-bold tabular-nums", s.valueColor)}>{s.value}</div>
              {s.sub && <p className="text-[11px] text-muted-foreground/60 mt-1">{s.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
