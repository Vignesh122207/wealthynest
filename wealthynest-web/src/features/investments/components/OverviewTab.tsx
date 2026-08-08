"use client";

import {useMemo, useState} from "react";
import {BarChart3, Info} from "lucide-react";
import {Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipValueType} from "recharts";
import {EmptyState} from "@/components/shared/EmptyState";
import {InfoTooltip} from "@/components/ui/Tooltip";
import {chartValueToNumber, cn, formatDate} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {useChartTheme} from "@/hooks/useChartTheme";
import {IncomeTypeBadge} from "./IncomeTypeBadge";
import {INV_TYPE_LABELS} from "../constants";
import {INVESTMENT_TYPE_META} from "@/lib/investmentTypeMeta";
import type {
    IncomeHistory,
    IncomeHistoryRecord,
    Investment,
    InvestmentType
} from "@/features/investments/types/investment.types";

type IncomeFilter = "ALL" | "DIVIDEND" | "BOND_COUPON" | "FD_MATURITY";

export function OverviewTab({ investments, year, onYearChange, incomeHistory, portfolioXirr }: {
  investments: Investment[]; year: number; onYearChange: (y: number) => void;
  incomeHistory: IncomeHistory | undefined;
  /** Money-weighted annualized return across every active investment's combined cashflow
   * timeline — undefined while loading, null when there isn't enough cashflow history to
   * compute one yet (e.g. a same-day purchase with no SIP ledger). */
  portfolioXirr?: number | null;
}) {
  const { fmt } = useAmountFormatter();
  const chart          = useChartTheme();
  const currentYear    = new Date().getFullYear();
  const [incomeFilter, setIncomeFilter] = useState<IncomeFilter>("ALL");
  const [incomePage, setIncomePage] = useState(1);
  const INCOME_PAGE_SIZE = 10;

  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalCurrent  = investments.reduce((s, i) => s + i.currentValue,   0);
  const totalGain     = totalCurrent - totalInvested;
  const gainPct       = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  // XIRR is the money-weighted, annualized return across every cashflow (SIP buys/redeems,
  // dated) — distinct from "Overall Return" above, which is a simple (current − invested) /
  // invested with no time dimension, so two holdings of very different ages can show the same
  // Overall Return but very different XIRR.
  const xirrLoading = portfolioXirr === undefined;
  const xirrKnown    = typeof portfolioXirr === "number";
  const xirrPositive = xirrKnown && portfolioXirr >= 0;

  // Each type's own fixed color from INVESTMENT_TYPE_META — the same indigo/emerald/amber/sky/
  // violet used by this page's tab bar, FAB, and card icons, so "Stock" reads as the same color
  // here as it does everywhere else on the page instead of a rank-based hue that shifts whenever
  // the portfolio's biggest holding changes.
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    investments.forEach(i => { map[i.investmentType] = (map[i.investmentType] ?? 0) + i.currentValue; });
    return Object.entries(map)
      .map(([type, val]) => ({
        name: type, value: val,
        color: INVESTMENT_TYPE_META[type as InvestmentType]?.hex ?? "#64748b",
      }))
      .sort((a, b) => b.value - a.value);
  }, [investments]);

  if (investments.length === 0) return (
    <EmptyState icon={BarChart3} title="No investments yet"
      description="Add stocks, mutual funds, gold, FDs or bonds to see your portfolio overview." />
  );

  const gainUp = totalGain >= 0;
  const gainColorClass = gainUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  const xirrColorClass = !xirrKnown ? "text-muted-foreground" : xirrPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-4">
      {/* One fused hero (lead metric + divider + flanking stats) instead of five identical stat
          chips — same shell as each instrument tab's own TabSummaryBar, but leading with the
          whole-portfolio value since Overview spans every instrument type rather than one. */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-0">
        <div className="flex-1 sm:pr-6 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Total Portfolio Value</p>
          <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-foreground">{fmt(totalCurrent)}</p>
          <p className="text-xs font-semibold mt-1.5 tabular-nums">
            <span className={gainColorClass}>
              {gainUp ? "▲" : "▼"} {gainUp ? "+" : ""}{fmt(totalGain)} ({gainPct >= 0 ? "+" : ""}{gainPct.toFixed(2)}%) overall
            </span>
            {" · "}
            <span className={xirrColorClass}>
              {xirrLoading ? "…" : xirrKnown ? `${xirrPositive ? "+" : ""}${portfolioXirr.toFixed(2)}% XIRR` : "XIRR —"}
            </span>
            <InfoTooltip
              className="ml-1 align-middle" side="bottom"
              content="XIRR is your annualized return across every buy/sell/redeem, weighted by when each happened. “Overall” is just (current − invested) / invested with no time dimension — a new holding and an old one can show the same Overall Return but very different XIRR." />
          </p>
        </div>

        <div className="h-px sm:h-auto sm:w-px bg-border shrink-0" />

        <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1 sm:pt-0 sm:pl-6">
          <div className="min-w-[84px]">
            <p className="text-[10.5px] font-semibold text-muted-foreground mb-0.5">Total Invested</p>
            <p className="text-sm font-bold tabular-nums text-foreground">{fmt(totalInvested)}</p>
          </div>
          <div className="min-w-[84px]">
            <p className="text-[10.5px] font-semibold text-muted-foreground mb-0.5">Instrument Types</p>
            <p className="text-sm font-bold tabular-nums text-foreground">{byType.length}</p>
          </div>
        </div>
      </div>

      {byType.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Allocation by Instrument</h3>
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Donut with center label */}
            <div className="relative w-48 shrink-0 mx-auto sm:mx-0">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byType} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2} dataKey="value" stroke="none">
                    {byType.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={chart.tooltipStyle}
                    labelStyle={chart.labelStyle}
                    itemStyle={chart.itemStyle}
                    wrapperStyle={{ zIndex: 20 }}
                    formatter={(v: TooltipValueType | undefined, _: number | string | undefined, props: { payload?: { name?: string } }) => [fmt(chartValueToNumber(v)), INV_TYPE_LABELS[props.payload?.name ?? ""] ?? props.payload?.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                <p className="text-xs text-muted-foreground/80 uppercase tracking-wide">Portfolio</p>
                <p className="text-sm font-bold text-foreground tabular-nums">{fmt(totalCurrent)}</p>
              </div>
            </div>
            {/* Legend with bars */}
            <div className="flex-1 space-y-2.5 w-full pt-1">
              {byType.map(s => {
                const pct = totalCurrent > 0 ? (s.value / totalCurrent) * 100 : 0;
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-xs font-medium text-foreground">
                          {INV_TYPE_LABELS[s.name] ?? s.name.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold tabular-nums" style={{ color: s.color }}>{pct.toFixed(1)}%</span>
                        <span className="text-xs text-muted-foreground ml-1.5 tabular-nums">{fmt(s.value)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: s.color + "cc" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Income History ───────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Auto-Income History</h3>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              Dividends, bond coupons and FD payouts credited automatically each evening
            </p>
          </div>
          <select
            value={year}
            onChange={e => onYearChange(Number(e.target.value))}
            className="h-8 px-2 rounded-lg bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-indigo-500">
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Summary chips — clickable to filter */}
        {incomeHistory && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: "DIVIDEND"    as IncomeFilter, label: "Dividends",    value: incomeHistory.summary.dividendTotal,   color: "text-indigo-400",  ring: "ring-indigo-500/40",  bg: "bg-indigo-500/12 border-indigo-500/15"  },
              { key: "BOND_COUPON" as IncomeFilter, label: "Bond Coupon",  value: incomeHistory.summary.bondCouponTotal, color: "text-violet-400",  ring: "ring-violet-500/40",  bg: "bg-violet-500/12 border-violet-500/15"  },
              { key: "FD_MATURITY" as IncomeFilter, label: "FD Maturity",  value: incomeHistory.summary.fdMaturityTotal, color: "text-sky-400",     ring: "ring-sky-500/40",     bg: "bg-sky-500/12 border-sky-500/15"         },
              { key: "ALL"         as IncomeFilter, label: "Total Income", value: incomeHistory.summary.grandTotal,      color: "text-emerald-400", ring: "ring-emerald-500/40", bg: "bg-emerald-500/12 border-emerald-500/15" },
            ].map(({ key, label, value, color, ring, bg }) => (
              <button key={key} type="button" onClick={() => { setIncomeFilter(k => k === key ? "ALL" : key); setIncomePage(1); }}
                className={cn(`rounded-xl border p-3 text-left transition-all`, bg,
                  incomeFilter === key && key !== "ALL" ? `ring-2 ${ring}` : "")}>
                <p className="text-xs text-muted-foreground/80 uppercase tracking-wide mb-1 flex items-center gap-1">
                  {label}
                  {incomeFilter === key && key !== "ALL" && <span className="text-[8px] bg-current/20 px-1 rounded">active</span>}
                </p>
                <p className={`text-sm font-bold tabular-nums ${color}`}>{fmt(value)}</p>
              </button>
            ))}
          </div>
        )}

        {/* Filter pills */}
        {incomeHistory && incomeHistory.records.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground/80 font-medium">Filter:</span>
            {(["ALL", "DIVIDEND", "BOND_COUPON", "FD_MATURITY"] as IncomeFilter[]).map(f => (
              <button key={f} type="button" onClick={() => { setIncomeFilter(f); setIncomePage(1); }}
                className={cn("h-6 px-2.5 rounded-lg text-xs font-medium transition-all border",
                  incomeFilter === f
                    ? f === "DIVIDEND"     ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-400"
                    : f === "BOND_COUPON"  ? "bg-violet-500/15 border-violet-500/40 text-violet-400"
                    : f === "FD_MATURITY"  ? "bg-sky-500/15 border-sky-500/40 text-sky-400"
                    :                        "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : "bg-muted/60 border-border text-muted-foreground/80 hover:text-foreground")}>
                {f === "ALL" ? "All" : f === "DIVIDEND" ? "Dividends" : f === "BOND_COUPON" ? "Coupons" : "FD Maturity"}
              </button>
            ))}
            {incomeFilter !== "ALL" && (
              <span className="text-xs text-muted-foreground/80">
                {(incomeHistory.records.filter(r => r.incomeType === incomeFilter)).length} records
              </span>
            )}
          </div>
        )}

        {/* Records list */}
        {(() => {
          const visibleRecords = incomeFilter === "ALL"
            ? (incomeHistory?.records ?? [])
            : (incomeHistory?.records.filter(r => r.incomeType === incomeFilter) ?? []);

          const totalIncomePages = Math.max(1, Math.ceil(visibleRecords.length / INCOME_PAGE_SIZE));
          const pageIncomeRecords = visibleRecords.slice((incomePage - 1) * INCOME_PAGE_SIZE, incomePage * INCOME_PAGE_SIZE);

          return incomeHistory && incomeHistory.records.length > 0 ? (
            visibleRecords.length > 0 ? (<>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">Date</th>
                      <th className="text-left text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">Type</th>
                      <th className="text-left text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">Investment</th>
                      <th className="text-left text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">Account Credited</th>
                      <th className="text-right text-xs text-muted-foreground/80 uppercase tracking-wide pb-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageIncomeRecords.map((r: IncomeHistoryRecord, idx: number) => (
                      <tr key={r.id ?? `hist-${idx}`} className={cn(
                        "border-b border-border/60 last:border-0 transition-colors",
                        r.credited ? "hover:bg-muted/20" : "opacity-60 hover:opacity-80 hover:bg-muted/10"
                      )}>
                        <td className="py-2.5 pr-4 text-muted-foreground tabular-nums whitespace-nowrap">{formatDate(r.eventDate)}</td>
                        <td className="py-2.5 pr-4 whitespace-nowrap"><IncomeTypeBadge type={r.incomeType} /></td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-foreground font-medium">{r.investmentName}</p>
                            {!r.investmentActive && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">Sold</span>
                            )}
                          </div>
                          {r.symbol && <p className="text-xs text-muted-foreground/80">{r.symbol}</p>}
                        </td>
                        <td className="py-2.5 pr-4">
                          {r.credited
                            ? r.accountName
                              ? <span className="text-muted-foreground">{r.accountName}</span>
                              : <span className="text-muted-foreground/80 italic">Not linked</span>
                            : <span className="text-xs px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground/80 italic">History</span>
                          }
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums">
                          <span className={r.credited ? "text-emerald-400" : "text-muted-foreground/80"}>
                            {r.credited ? "+" : ""}{fmt(r.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalIncomePages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <span className="text-xs text-muted-foreground/80">
                    {(incomePage - 1) * INCOME_PAGE_SIZE + 1}–{Math.min(incomePage * INCOME_PAGE_SIZE, visibleRecords.length)} of {visibleRecords.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setIncomePage(p => Math.max(1, p - 1))} disabled={incomePage === 1}
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-muted/60 hover:bg-muted text-xs text-muted-foreground disabled:opacity-40 transition-all">
                      ‹
                    </button>
                    {Array.from({ length: totalIncomePages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setIncomePage(p)}
                        className={cn("h-7 w-7 flex items-center justify-center rounded-lg text-xs transition-all",
                          p === incomePage ? "bg-indigo-600 text-white" : "bg-muted/60 hover:bg-muted text-muted-foreground")}>
                        {p}
                      </button>
                    ))}
                    <button onClick={() => setIncomePage(p => Math.min(totalIncomePages, p + 1))} disabled={incomePage === totalIncomePages}
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-muted/60 hover:bg-muted text-xs text-muted-foreground disabled:opacity-40 transition-all">
                      ›
                    </button>
                  </div>
                </div>
              )}
            </>) : (
              <p className="text-xs text-muted-foreground/80 text-center py-4">
                No {incomeFilter === "DIVIDEND" ? "dividend" : incomeFilter === "BOND_COUPON" ? "coupon" : "FD maturity"} records for {year}.
              </p>
            )
          ) : incomeHistory ? (
            <p className="text-xs text-muted-foreground/80 text-center py-6">
              No auto-income events recorded for {year}.
              {year === currentYear && " Income will appear here once the scheduler runs (8 PM IST daily)."}
            </p>
          ) : (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          );
        })()}

        <div className="flex items-start gap-2 pt-1">
          <Info className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground/80">
            Configure which account receives auto-income by setting a <strong className="text-muted-foreground">linked account</strong> when adding or editing each investment.
            Credited amounts also appear in that account&apos;s transaction history.
          </p>
        </div>
      </div>
    </div>
  );
}
