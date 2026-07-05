"use client";

import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn, formatCurrencyCompact } from "@/lib/utils";
import type { BudgetSummary } from "@/features/dashboard/types/dashboard.types";

// ── SVG Ring Progress ─────────────────────────────────────────────────────────

function RingProgress({ pct, size = 44, stroke = 4, color }: {
  pct: number; size?: number; stroke?: number; color: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ transform: "rotate(-90deg)" }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" strokeWidth={stroke} className="text-muted" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease" }} />
    </svg>
  );
}

// ── Individual widget ─────────────────────────────────────────────────────────

function InsightWidget({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "flex-1 min-w-[140px] flex items-center gap-3 bg-card rounded-2xl px-4 py-3.5 border border-border/50 shadow-sm",
      className
    )}>
      {children}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface InsightRowProps {
  savingsRate:         number | undefined;
  netCashFlow:         number;
  totalAccountBalance: number;
  budgetSummaries:     BudgetSummary[];
  monthlyIncome:       number | undefined;
  year:                number;
  month:               number;
  isLoading:           boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InsightRow({
  savingsRate, netCashFlow, totalAccountBalance, budgetSummaries, monthlyIncome,
  year, month, isLoading,
}: InsightRowProps) {
  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1 animate-fade-in-up delay-300">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex-1 min-w-[140px] h-16 rounded-2xl shimmer" />
        ))}
      </div>
    );
  }

  const srPct         = savingsRate ?? 0;
  const srColor       = srPct >= 25 ? "#22c55e" : srPct >= 10 ? "#f59e0b" : "#f43f5e";
  const cfPositive    = netCashFlow >= 0;
  const onTrack       = budgetSummaries.filter(b => !b.overBudget).length;
  const totalBudgets  = budgetSummaries.length;
  const budgetHealth  = totalBudgets > 0 ? (onTrack / totalBudgets) * 100 : 100;
  const budgetColor   = budgetHealth >= 80 ? "#22c55e" : budgetHealth >= 50 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 animate-fade-in-up delay-300"
      style={{ scrollbarWidth: "none" }}>

      {/* Savings Rate */}
      {monthlyIncome != null && monthlyIncome > 0 && (
        <InsightWidget>
          <RingProgress pct={srPct} color={srColor} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground tabular-nums">{srPct.toFixed(0)}%</p>
            <p className="text-[11px] text-muted-foreground/70 whitespace-nowrap">Savings rate</p>
          </div>
        </InsightWidget>
      )}

      {/* Net Cash Flow */}
      {monthlyIncome != null && monthlyIncome > 0 && (
        <InsightWidget>
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            cfPositive ? "bg-emerald-500/10" : "bg-red-500/10"
          )}>
            {cfPositive
              ? <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              : <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-400" />}
          </div>
          <div className="min-w-0">
            <p className={cn(
              "text-sm font-bold tabular-nums whitespace-nowrap",
              cfPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
            )}>
              {cfPositive ? "+" : ""}{formatCurrencyCompact(netCashFlow)}
            </p>
            <p className="text-[11px] text-muted-foreground/70 whitespace-nowrap">Net cash flow</p>
          </div>
        </InsightWidget>
      )}

      {/* Wallet balance */}
      <InsightWidget>
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Wallet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground tabular-nums whitespace-nowrap">
            {formatCurrencyCompact(totalAccountBalance)}
          </p>
          <p className="text-[11px] text-muted-foreground/70 whitespace-nowrap">Accounts</p>
        </div>
      </InsightWidget>

      {/* Budget health */}
      {totalBudgets > 0 && (
        <InsightWidget>
          <RingProgress pct={budgetHealth} color={budgetColor} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground tabular-nums whitespace-nowrap">
              {onTrack}/{totalBudgets} on track
            </p>
            <p className="text-[11px] text-muted-foreground/70 whitespace-nowrap">Budget health</p>
          </div>
        </InsightWidget>
      )}

    </div>
  );
}
