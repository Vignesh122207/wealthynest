"use client";

import {cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {useTypeXirr} from "@/features/investments/hooks/useInvestments";
import type {Investment} from "@/features/investments/types/investment.types";
import type {TabId} from "../constants";

interface Flank { label: string; value: string; color?: string; }

// One fused hero (lead metric + divider + flanking stats) instead of a flat grid of 5-6
// identical stat chips — same shell across every tab (see the investments-page redesign), with
// the lead metric, its sub-line, and the flanking stats tailored to what actually matters for
// that instrument type (XIRR for stocks, 24K-equivalent for gold, accrued interest for FDs,
// coupon income for bonds) rather than repeating the same five fields everywhere.
export function TabSummaryBar({ investments, tab }: { investments: Investment[]; tab: TabId }) {
  const { fmt } = useAmountFormatter();
  // Money-weighted, annualized return across every active stock's combined cashflow timeline —
  // distinct from "Overall Return" below, which is a simple (current − invested) / invested with
  // no time dimension. Only fetched on the Stocks tab; other tabs don't ask for it yet.
  const { data: stocksXirr } = useTypeXirr("STOCK", tab === "stocks" && investments.length > 0);

  if (investments.length === 0) return null;

  const totalInvested  = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalCurrent   = investments.reduce((s, i) => s + i.currentValue,   0);
  const totalGain      = totalCurrent - totalInvested;
  const gainPct        = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const gainUp         = totalGain >= 0;
  const gainColorClass = gainUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  const gainSub = (
    <span className={gainColorClass}>
      {gainUp ? "▲" : "▼"} {gainUp ? "+" : ""}{fmt(totalGain)} ({gainPct >= 0 ? "+" : ""}{gainPct.toFixed(2)}%) overall
    </span>
  );

  let heroLabel: string = "Current Value";
  let heroValue: string = fmt(totalCurrent);
  let heroSub: React.ReactNode = gainSub;
  let flanks: Flank[];

  if (tab === "stocks") {
    heroLabel = "Market Value";
    const xirrKnown    = typeof stocksXirr === "number";
    const xirrPositive = xirrKnown && stocksXirr >= 0;
    flanks = [
      { label: "Invested", value: fmt(totalInvested) },
      { label: "Overall XIRR", value: xirrKnown ? `${xirrPositive ? "+" : ""}${stocksXirr.toFixed(2)}%` : "—",
        color: !xirrKnown ? undefined : xirrPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400" },
      { label: "Holdings", value: `${investments.length} stock${investments.length !== 1 ? "s" : ""}` },
    ];
  } else if (tab === "mf") {
    const totalUnits = investments.reduce((s, i) => s + Number(i.units ?? 0), 0);
    flanks = [
      { label: "Invested", value: fmt(totalInvested) },
      { label: "Total Units", value: `${totalUnits.toFixed(3)} u` },
      { label: "Holdings", value: `${investments.length} fund${investments.length !== 1 ? "s" : ""}` },
    ];
  } else if (tab === "gold") {
    heroLabel = "Market Value";
    // Sum grams as 24K equivalent so 18K and 22K grams aren't added to 24K grams raw
    const total24kEq = investments.reduce((s, i) => {
      const k = i.goldKarat ?? 22;
      return s + Number(i.quantityGrams ?? 0) * k / 24;
    }, 0);
    flanks = [
      { label: "Invested", value: fmt(totalInvested) },
      { label: "24K Equivalent", value: `${total24kEq.toFixed(2)}g` },
      { label: "Holdings", value: `${investments.length} item${investments.length !== 1 ? "s" : ""}` },
    ];
  } else if (tab === "fd") {
    const totalMaturity = investments.reduce((s, i) => s + (i.maturityAmount ?? i.investedAmount), 0);
    const totalAccrued  = investments.reduce((s, i) => s + (i.accruedInterest ?? 0), 0);
    const avgRate       = investments.reduce((s, i) => s + (i.couponRate ?? 0), 0) / investments.length;
    const totalInterest = totalMaturity - totalInvested;
    heroLabel = "Maturity Value";
    heroValue = fmt(totalMaturity);
    heroSub = <span className="text-emerald-600 dark:text-emerald-400">+{fmt(totalInterest)} total interest at maturity</span>;
    flanks = [
      { label: "Total Principal", value: fmt(totalInvested) },
      { label: "Accrued So Far",  value: `+${fmt(totalAccrued)}`, color: "text-emerald-600 dark:text-emerald-400" },
      { label: "Avg Rate",        value: `${avgRate.toFixed(2)}% p.a.` },
    ];
  } else if (tab === "bonds") {
    const avgCoupon    = investments.reduce((s, i) => s + (i.couponRate ?? 0), 0) / investments.length;
    const annualIncome = investments.reduce((s, i) => s + ((i.avgBuyPrice ?? 0) * (i.units ?? 1) * (i.couponRate ?? 0) / 100), 0);
    heroSub = <span className="text-violet-600 dark:text-violet-400">{fmt(annualIncome)} annual coupon income</span>;
    flanks = [
      { label: "Face Value",      value: fmt(totalInvested) },
      { label: "Monthly Income",  value: fmt(annualIncome / 12), color: "text-violet-600 dark:text-violet-400" },
      { label: "Avg Coupon Rate", value: `${avgCoupon.toFixed(2)}% p.a.` },
    ];
  } else {
    return null;
  }

  return (
    <div data-testid="tab-summary-bar" className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-0">
      <div className="flex-1 sm:pr-6 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{heroLabel}</p>
        <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-foreground">{heroValue}</p>
        <p className="text-xs font-semibold mt-1.5 tabular-nums">{heroSub}</p>
      </div>

      <div className="h-px sm:h-auto sm:w-px bg-border shrink-0" />

      <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1 sm:pt-0 sm:pl-6">
        {flanks.map(f => (
          <div key={f.label} className="min-w-[84px]">
            <p className="text-[10.5px] font-semibold text-muted-foreground mb-0.5">{f.label}</p>
            <p className={cn("text-sm font-bold tabular-nums", f.color ?? "text-foreground")}>{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
