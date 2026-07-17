"use client";

import { TrendingUp } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip, ResponsiveContainer,
} from "recharts";
import { cn, formatChartTickINR } from "@/lib/utils";
import type { useChartTheme } from "@/hooks/useChartTheme";
import type { NetWorthHistoryPoint } from "@/features/networth/types/networth.types";

// ─── Net Worth History ────────────────────────────────────────────────────────

export function NetWorthHistoryChart({
  nwHistory, yearlyNwData, histViewMode, setHistViewMode, chart, fmt,
}: {
  nwHistory:    NetWorthHistoryPoint[];
  yearlyNwData: { year: number; netWorth: number }[];
  histViewMode: "monthly" | "yearly";
  setHistViewMode: (mode: "monthly" | "yearly") => void;
  chart: ReturnType<typeof useChartTheme>;
  fmt: (n: number) => string;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Net Worth History</h2>
        {nwHistory.length > 1 && (
          <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
            {(["monthly", "yearly"] as const).map((mode) => (
              <button key={mode} onClick={() => setHistViewMode(mode)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all",
                  histViewMode === mode
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                {mode === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="bg-card border border-border rounded-2xl p-5">
        {nwHistory.length > 1 ? (
          histViewMode === "monthly" ? (
            <>
              <p className="text-xs text-muted-foreground mb-4">Monthly net worth trend (last {nwHistory.length} months)</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={nwHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={formatChartTickINR} />
                  <Tooltip
                    contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                    cursor={chart.cursorStyle}
                    formatter={(v: number) => [fmt(v), "Net Worth"]}
                  />
                  <ReferenceLine y={0} stroke={chart.gridColor} strokeWidth={1.5} />
                  <Line
                    type="monotone" dataKey="netWorth" stroke="#6366f1" strokeWidth={2.5}
                    dot={{ fill: "#6366f1", r: 3.5, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#a78bfa", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-4">Year-end net worth snapshot ({yearlyNwData.length} {yearlyNwData.length === 1 ? "year" : "years"})</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={yearlyNwData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={formatChartTickINR} />
                  <Tooltip
                    contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                    cursor={{ fill: "rgba(99,102,241,0.06)" }}
                    formatter={(v: number) => [fmt(v), "Net Worth"]}
                  />
                  <ReferenceLine y={0} stroke={chart.gridColor} strokeWidth={1.5} />
                  <Bar dataKey="netWorth" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="w-8 h-8 text-muted mb-2" />
            <p className="text-sm font-medium text-foreground">History builds over time</p>
            <p className="text-xs text-muted-foreground/80 mt-1 max-w-xs">
              A monthly snapshot is taken automatically on the 1st of each month.
              Come back next month to see your net worth trend here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
