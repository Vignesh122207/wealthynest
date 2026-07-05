"use client";

import Link from "next/link";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface InvestmentPanelProps {
  totalInvested:        number;
  totalInvestmentValue: number;
  totalDividendIncome:  number;
}

export function InvestmentPanel({
  totalInvested, totalInvestmentValue, totalDividendIncome,
}: InvestmentPanelProps) {
  const gainLoss = totalInvestmentValue - totalInvested;
  const gainPct  = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;
  const isGain   = gainLoss >= 0;

  const tiles = [
    {
      label: "Invested",
      value: totalInvested,
      color: "text-foreground",
      bg:    "bg-muted/40",
      sub:   null,
      icon:  null,
    },
    {
      label: "Current Value",
      value: totalInvestmentValue,
      color: "text-primary",
      bg:    "bg-primary/8",
      sub:   null,
      icon:  null,
    },
    {
      label: "Gain / Loss",
      value: gainLoss,
      color: isGain ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
      bg:    isGain ? "bg-emerald-500/8" : "bg-red-500/8",
      sub:   `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`,
      icon:  isGain
        ? <ArrowUpRight className="w-3.5 h-3.5" />
        : <ArrowDownRight className="w-3.5 h-3.5" />,
    },
    {
      label: "Investment Income",
      value: totalDividendIncome,
      color: "text-amber-600 dark:text-amber-400",
      bg:    "bg-amber-500/8",
      sub:   "Dividends · Interest",
      icon:  null,
    },
  ];

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm animate-fade-in-up">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(({ label, value, color, bg, sub, icon }) => (
          <div key={label} className={cn("rounded-2xl p-4 border border-border/30", bg)}>
            <p className="text-xs text-muted-foreground/70 mb-2 font-medium">{label}</p>
            <div className={cn("flex items-center gap-1 text-base font-bold tabular-nums", color)}>
              {icon}{formatCurrency(value)}
            </div>
            {sub && <p className="text-[11px] text-muted-foreground/60 mt-1">{sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
