"use client";

import {useMemo} from "react";
import {
    Activity,
    BadgePercent,
    Banknote,
    Building2,
    CalendarDays,
    Clock,
    Coins,
    Gem,
    Hash,
    Layers,
    type LucideIcon,
    Percent,
    TrendingDown,
    TrendingUp,
    Wallet,
} from "lucide-react";
import {cn} from "@/lib/utils";
import {type IconTone, PremiumIcon} from "@/components/icons/PremiumIcon";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {useTypeXirr} from "@/features/investments/hooks/useInvestments";
import type {Investment} from "@/features/investments/types/investment.types";
import type {TabId} from "../constants";

interface Stat { label: string; value: string; color: string; bg: string; icon: LucideIcon; tone: IconTone; }

export function TabSummaryBar({ investments, tab }: { investments: Investment[]; tab: TabId }) {
  const { fmt } = useAmountFormatter();
  // Money-weighted, annualized return across every active stock's combined cashflow timeline —
  // distinct from "Overall Return" below, which is a simple (current − invested) / invested with
  // no time dimension. Only fetched on the Stocks tab; other tabs don't ask for it yet.
  const { data: stocksXirr } = useTypeXirr("STOCK", tab === "stocks" && investments.length > 0);

  const stats = useMemo((): Stat[] | null => {
    if (investments.length === 0) return null;

    const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
    const totalCurrent  = investments.reduce((s, i) => s + i.currentValue,   0);
    const totalGain     = totalCurrent - totalInvested;
    const gainPct       = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    const gainUp        = totalGain >= 0;
    const gainColor     = gainUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
    const gainBg        = gainUp ? "bg-emerald-500/12 border-emerald-500/15" : "bg-red-500/12 border-red-500/15";
    const gainTone: IconTone = gainUp ? "emerald" : "red";
    const gainIcon       = gainUp ? TrendingUp : TrendingDown;

    if (tab === "stocks") {
      const xirrKnown = typeof stocksXirr === "number";
      const xirrPositive = xirrKnown && stocksXirr >= 0;
      return [
        { label: "Invested",       icon: Wallet,     tone: "gray",   value: fmt(totalInvested), color: "text-foreground",                   bg: "bg-muted/60 border-border" },
        { label: "Market Value",   icon: TrendingUp, tone: "indigo", value: fmt(totalCurrent),  color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/12 border-indigo-500/15" },
        { label: "Gain / Loss",    icon: gainIcon,   tone: gainTone, value: `${gainUp ? "+" : ""}${fmt(totalGain)}`,    color: gainColor, bg: gainBg },
        { label: "Overall Return", icon: Percent,    tone: gainTone, value: `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`,            color: gainColor, bg: gainBg },
        { label: "Overall XIRR",   icon: Activity,   tone: (!xirrKnown ? "gray" : xirrPositive ? "emerald" : "red") as IconTone,
          value: xirrKnown ? `${xirrPositive ? "+" : ""}${stocksXirr.toFixed(2)}%` : "—",
          color: !xirrKnown ? "text-muted-foreground" : xirrPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
          bg:    !xirrKnown ? "bg-muted/60 border-border" : xirrPositive ? "bg-emerald-500/12 border-emerald-500/15" : "bg-red-500/12 border-red-500/15" },
        { label: "Holdings",       icon: Layers,     tone: "gray",   value: `${investments.length} stock${investments.length !== 1 ? "s" : ""}`,
          color: "text-foreground", bg: "bg-muted/60 border-border" },
      ];
    }

    if (tab === "mf") {
      const totalUnits = investments.reduce((s, i) => s + Number(i.units ?? 0), 0);
      return [
        { label: "Invested",       icon: Wallet,     tone: "gray",    value: fmt(totalInvested), color: "text-foreground",                     bg: "bg-muted/60 border-border" },
        { label: "Current Value",  icon: Layers,     tone: "emerald", value: fmt(totalCurrent),  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/15" },
        { label: "Gain / Loss",    icon: gainIcon,   tone: gainTone,  value: `${gainUp ? "+" : ""}${fmt(totalGain)}`,    color: gainColor, bg: gainBg },
        { label: "Overall Return", icon: Percent,    tone: gainTone,  value: `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`,            color: gainColor, bg: gainBg },
        { label: "Total Units",    icon: Hash,       tone: "indigo",  value: `${totalUnits.toFixed(3)} u`,  color: "text-indigo-600 dark:text-indigo-400",   bg: "bg-indigo-500/12 border-indigo-500/15" },
      ];
    }

    if (tab === "gold") {
      // Sum grams as 24K equivalent so 18K and 22K grams aren't added to 24K grams raw
      const total24kEq = investments.reduce((s, i) => {
        const k = i.goldKarat ?? 22;
        return s + Number(i.quantityGrams ?? 0) * k / 24;
      }, 0);
      return [
        { label: "Invested",       icon: Wallet, tone: "gray",   value: fmt(totalInvested), color: "text-foreground",                   bg: "bg-muted/60 border-border" },
        { label: "Market Value",   icon: Coins,  tone: "orange", value: fmt(totalCurrent),  color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/12 border-amber-500/15" },
        { label: "Gain / Loss",    icon: gainIcon, tone: gainTone, value: `${gainUp ? "+" : ""}${fmt(totalGain)}`,   color: gainColor, bg: gainBg },
        { label: "Overall Return", icon: Percent, tone: gainTone, value: `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`,           color: gainColor, bg: gainBg },
        { label: "24K Equivalent", icon: Gem,    tone: "orange", value: `${total24kEq.toFixed(2)}g`,  color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/12 border-amber-500/15" },
      ];
    }

    if (tab === "fd") {
      const totalPrincipal = investments.reduce((s, i) => s + i.investedAmount, 0);
      const totalMaturity  = investments.reduce((s, i) => s + (i.maturityAmount ?? i.investedAmount), 0);
      const totalAccrued   = investments.reduce((s, i) => s + (i.accruedInterest ?? 0), 0);
      const avgRate        = investments.reduce((s, i) => s + (i.couponRate ?? 0), 0) / investments.length;
      const totalInterest  = totalMaturity - totalPrincipal;
      return [
        { label: "Total Principal",   icon: Wallet,     tone: "gray", value: fmt(totalPrincipal),     color: "text-foreground",                     bg: "bg-muted/60 border-border" },
        { label: "Maturity Value",    icon: Building2,  tone: "cyan", value: fmt(totalMaturity),       color: "text-sky-600 dark:text-sky-400",         bg: "bg-sky-500/12 border-sky-500/15" },
        { label: "Total Interest",    icon: TrendingUp, tone: "emerald", value: `+${fmt(totalInterest)}`, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/15" },
        { label: "Accrued So Far",    icon: Clock,      tone: "emerald", value: `+${fmt(totalAccrued)}`,  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/15" },
        { label: "Avg Interest Rate", icon: Percent,    tone: "cyan", value: `${avgRate.toFixed(2)}% p.a.`,       color: "text-sky-600 dark:text-sky-400",         bg: "bg-sky-500/12 border-sky-500/15" },
      ];
    }

    if (tab === "bonds") {
      const avgCoupon    = investments.reduce((s, i) => s + (i.couponRate ?? 0), 0) / investments.length;
      const annualIncome = investments.reduce((s, i) => s + ((i.avgBuyPrice ?? 0) * (i.units ?? 1) * (i.couponRate ?? 0) / 100), 0);
      return [
        { label: "Face Value",      icon: Wallet,       tone: "gray",   value: fmt(totalInvested),    color: "text-foreground",                   bg: "bg-muted/60 border-border" },
        { label: "Current Value",   icon: BadgePercent, tone: "violet", value: fmt(totalCurrent),     color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/12 border-violet-500/15" },
        { label: "Annual Coupon",   icon: Banknote,     tone: "violet", value: fmt(annualIncome),     color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/12 border-violet-500/15" },
        { label: "Monthly Income",  icon: CalendarDays, tone: "violet", value: fmt(annualIncome / 12), color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/12 border-violet-500/15" },
        { label: "Avg Coupon Rate", icon: Percent,      tone: "gray",   value: `${avgCoupon.toFixed(2)}% p.a.`,  color: "text-foreground",                   bg: "bg-muted/60 border-border" },
      ];
    }

    return null;
  }, [investments, tab, fmt, stocksXirr]);

  if (!stats) return null;

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 gap-3", stats.length > 5 ? "lg:grid-cols-6" : "lg:grid-cols-5")}>
      {stats.map(({ label, value, color, bg, icon, tone }) => (
        <div key={label} className={cn("rounded-2xl border p-4", bg)}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <PremiumIcon icon={icon} tone={tone} size="xs" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          </div>
          <p className={cn("text-sm font-bold tabular-nums leading-snug", color)}>{value}</p>
        </div>
      ))}
    </div>
  );
}
