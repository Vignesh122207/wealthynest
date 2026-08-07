"use client";

import {Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, type TooltipValueType, XAxis, YAxis,} from "recharts";
import {chartValueToNumber} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {CHART_COLORS} from "@/lib/chartColors";
import type {MonthlyTrend} from "@/features/dashboard/types/dashboard.types";

interface SixMonthTrendProps {
  trend: MonthlyTrend[];
  chart: {
    gridColor:    string;
    axisColor:    string;
    tooltipStyle: React.CSSProperties;
    labelStyle:   React.CSSProperties;
    itemStyle:    React.CSSProperties;
    cursorStyle:  object;
  };
  isLoading: boolean;
  /** Home's Year mode passes "12-Month Trend" + the full annual-trend array — the component is
   * already generic over `trend.length`, so nothing else here changes. */
  title?: string;
}

const GRAD_INCOME   = "dashboard6moIncomeGrad";
const GRAD_EXPENSES = "dashboard6moExpenseGrad";
const GRAD_SAVED     = "dashboard6moSavedGrad";

export function SixMonthTrend({ trend, chart, isLoading, title = "6-Month Trend" }: SixMonthTrendProps) {
  const { fmt, fmtC } = useAmountFormatter();
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm h-full flex flex-col animate-fade-in-up card-hover">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="font-bold text-foreground text-sm">{title}</h2>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">Income · Expenses · Savings</p>
        </div>
      </div>

      <div className="mt-4 flex-1 min-h-[200px]">
        {isLoading ? (
          <div className="w-full h-full rounded-2xl shimmer" />
        ) : trend.length > 0 ? (
          /* aria-hidden on the wrapper alone isn't enough — Recharts adds its own keyboard-nav
             layer (role="application" tabindex="0" on the inner <svg>) by default, which axe
             flags as a real WCAG violation ("aria-hidden-focus": a focusable element can't sit
             inside an aria-hidden subtree). accessibilityLayer={false} turns that default off to
             match this chart's own already-decorative intent. */
          <div className="w-full h-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <AreaChart data={trend} margin={{ left: 0, right: 0, top: 4, bottom: 0 }} accessibilityLayer={false}>
              <defs>
                <linearGradient id={GRAD_INCOME} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.income} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={CHART_COLORS.income} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={GRAD_EXPENSES} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.expense} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={CHART_COLORS.expense} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={GRAD_SAVED} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.saved} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={CHART_COLORS.saved} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: chart.axisColor, fontSize: 10, fontWeight: 500 }}
                axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => fmtC(v)} width={50} />
              <Tooltip
                contentStyle={chart.tooltipStyle}
                labelStyle={chart.labelStyle}
                itemStyle={chart.itemStyle}
                cursor={chart.cursorStyle}
                formatter={(v: TooltipValueType | undefined, name: number | string | undefined) => [fmt(chartValueToNumber(v)), name ?? ""]}
              />
              <Legend iconType="circle" iconSize={6}
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: chart.axisColor }} />
              <Area type="monotone" dataKey="income"   name="Income"
                stroke={CHART_COLORS.income} strokeWidth={2} fill={`url(#${GRAD_INCOME})`} dot={false} activeDot={{ r: 4 }} />
              <Area type="monotone" dataKey="expenses" name="Expenses"
                stroke={CHART_COLORS.expense} strokeWidth={2} fill={`url(#${GRAD_EXPENSES})`} dot={false} activeDot={{ r: 4 }} />
              <Area type="monotone" dataKey="saved"    name="Saved"
                stroke={CHART_COLORS.saved} strokeWidth={2} fill={`url(#${GRAD_SAVED})`}    dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-6 text-center">
            <p className="text-sm font-medium text-foreground">History builds over time</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
              Your income, expense, and savings trend will appear here once a few months of data are in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
