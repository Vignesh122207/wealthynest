"use client";

import Link from "next/link";
import {Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, type TooltipValueType, XAxis, YAxis,} from "recharts";
import {TrendingUp} from "lucide-react";
import {chartValueToNumber, cn, formatChartTickINR, formatTrendDelta} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {CHART_COLORS} from "@/lib/chartColors";
import type {NetWorthHistoryPoint} from "@/features/networth/types/networth.types";

interface NetWorthTrendProps {
  history:      NetWorthHistoryPoint[];
  netWorth:     number | undefined;
  changePct:    number | undefined;
  chart: {
    gridColor:    string;
    axisColor:    string;
    tooltipStyle: React.CSSProperties;
    labelStyle:   React.CSSProperties;
    itemStyle:    React.CSSProperties;
    cursorStyle:  object;
  };
  isLoading: boolean;
}

const GRAD_ID = "dashboardNwGrad";

export function NetWorthTrend({ history, netWorth, changePct, chart, isLoading }: NetWorthTrendProps) {
  const { fmt } = useAmountFormatter();
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm h-full flex flex-col card-hover">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-foreground text-sm">Net Worth Trend</h2>
        <Link href="/assets" className="text-[11px] font-semibold text-primary hover:underline transition-colors">
          View details →
        </Link>
      </div>

      {isLoading ? (
        <div className="h-9 w-40 rounded-xl shimmer mt-3" />
      ) : (
        <div className="mt-1">
          <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight leading-none">
            {netWorth != null ? fmt(netWorth) : "—"}
          </p>
          {changePct != null && (
            <p className={cn(
              "text-xs font-semibold mt-1.5",
              changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
            )}>
              {formatTrendDelta(changePct)}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex-1 min-h-[180px]">
        {history.length > 1 ? (
          <div className="w-full h-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
            <AreaChart data={history} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={GRAD_ID} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={formatChartTickINR}
                width={50} />
              <Tooltip
                contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                cursor={chart.cursorStyle}
                formatter={(v: TooltipValueType | undefined) => [fmt(chartValueToNumber(v)), "Net Worth"]}
              />
              <ReferenceLine y={0} stroke={chart.gridColor} strokeWidth={1.5} />
              <Area type="monotone" dataKey="netWorth" stroke={CHART_COLORS.primary} strokeWidth={2.5}
                fill={`url(#${GRAD_ID})`} dot={{ fill: CHART_COLORS.primary, r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#a78bfa", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-6 text-center">
            <TrendingUp className="w-8 h-8 text-muted mb-2" />
            <p className="text-sm font-medium text-foreground">History builds over time</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
              A monthly snapshot is taken automatically on the 1st. Come back next month to see your trend here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
