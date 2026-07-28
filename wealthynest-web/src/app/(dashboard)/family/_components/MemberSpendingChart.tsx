"use client";

import {BarChart2, ChevronLeft, ChevronRight, X} from "lucide-react";
import {Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, type TooltipValueType, XAxis, YAxis,} from "recharts";
import {GlossyBadge, PremiumIcon} from "@/components/icons/PremiumIcon";
import {chartValueToNumber, cn, formatCurrencyCompact, getInitials} from "@/lib/utils";
import type {useChartTheme} from "@/hooks/useChartTheme";

type MemberSpendingEntry = { id: string; name: string; amount: number; color: string; fullName: string };
type DrillMember = { id: string; fullName: string } | undefined;

// ── Per-member spending chart, with click-to-drilldown into category breakdown ──

export function MemberSpendingChart({
  memberSpending, chart, chartMonthLabel, navigateChart, isCurrentChartMonth,
  drillMemberId, setDrillMemberId, drillMember, drillExpensesCount, drillByCategory, drillTotal, memberColorMap,
  fmt, fmtC,
}: {
  memberSpending: MemberSpendingEntry[];
  chart: ReturnType<typeof useChartTheme>;
  chartMonthLabel: string;
  navigateChart: (dir: -1 | 1) => void;
  isCurrentChartMonth: boolean;
  drillMemberId: string | null;
  setDrillMemberId: React.Dispatch<React.SetStateAction<string | null>>;
  drillMember: DrillMember;
  drillExpensesCount: number;
  drillByCategory: [string, number][];
  drillTotal: number;
  memberColorMap: Map<string, string>;
  fmt: (n: number) => string;
  fmtC: (n: number) => string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <PremiumIcon icon={BarChart2} tone="indigo" size="xs" />
          <h3 className="text-sm font-semibold text-foreground">Member Spending</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navigateChart(-1)}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 border border-border flex items-center justify-center transition-all">
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <span className="text-xs text-muted-foreground min-w-[7.5rem] text-center">{chartMonthLabel}</span>
          <button onClick={() => navigateChart(1)} disabled={isCurrentChartMonth}
            className={cn("w-7 h-7 rounded-lg border flex items-center justify-center transition-all",
              isCurrentChartMonth ? "bg-muted/40 border-border/40 opacity-30 cursor-not-allowed" : "bg-muted hover:bg-muted/80 border-border")}>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {memberSpending.length > 0 ? "Click a bar to see breakdown" : "No expenses recorded"}
      </p>

      {memberSpending.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={Math.max(120, memberSpending.length * 44)}>
            <BarChart data={memberSpending} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} horizontal={false} />
              <XAxis type="number" tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => formatCurrencyCompact(v)} />
              <YAxis type="category" dataKey="name" tick={{ fill: chart.axisColor, fontSize: 12 }}
                axisLine={false} tickLine={false} width={72} />
              <Tooltip contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                cursor={chart.cursorStyle}
                formatter={(v: TooltipValueType | undefined, _: number | string | undefined, props: { payload?: { fullName?: string } }) => [fmt(chartValueToNumber(v)), props.payload?.fullName ?? "Spending"]} />
              <Bar dataKey="amount" radius={[0, 6, 6, 0]} style={{ cursor: "pointer" }}
                onClick={(data: { id?: string }) => setDrillMemberId(prev => prev === data.id ? null : (data.id ?? null))}>
                {memberSpending.map((m, i) => (
                  <Cell key={i} fill={m.color} opacity={drillMemberId && drillMemberId !== m.id ? 0.35 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {memberSpending.map((m, i) => (
              <button key={i} onClick={() => setDrillMemberId(prev => prev === m.id ? null : m.id)}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                <span className="text-xs text-muted-foreground">{m.fullName}</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">{fmtC(m.amount)}</span>
              </button>
            ))}
          </div>

          {/* Drilldown panel */}
          {drillMemberId && drillMember && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GlossyBadge hex={memberColorMap.get(drillMemberId) ?? "#6366f1"} size="xs" className="shrink-0">
                    <span className="text-[9px] font-bold text-white">{getInitials(drillMember.fullName)}</span>
                  </GlossyBadge>
                  <p className="text-xs font-semibold text-foreground">{drillMember.fullName}</p>
                  <span className="text-xs text-muted-foreground">· {drillExpensesCount} expense{drillExpensesCount !== 1 ? "s" : ""}</span>
                </div>
                <button onClick={() => setDrillMemberId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {drillByCategory.map(([cat, amt]) => (
                  <div key={cat} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-1.5 rounded-full shrink-0" style={{
                        width: `${Math.round((amt / drillTotal) * 80)}px`,
                        background: memberColorMap.get(drillMemberId) ?? "#6366f1", opacity: 0.6,
                      }} />
                      <span className="text-xs text-foreground truncate">{cat}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground/60">{((amt / drillTotal) * 100).toFixed(0)}%</span>
                      <span className="text-xs font-semibold tabular-nums text-red-600 dark:text-red-400">−{fmtC(amt)}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Total</span>
                  <span className="text-xs font-bold tabular-nums text-red-600 dark:text-red-400">−{fmt(drillTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground">No expenses recorded for {chartMonthLabel}</p>
        </div>
      )}
    </div>
  );
}
