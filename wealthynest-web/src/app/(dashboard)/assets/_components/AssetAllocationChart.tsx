"use client";

import {Cell, Pie, PieChart as RechartsPie, ResponsiveContainer, Sector, Tooltip} from "recharts";
import {PieChart} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import type {useChartTheme} from "@/hooks/useChartTheme";
import type {NetWorthSummary} from "@/features/networth/types/networth.types";

type PieSlice = { name: string; value: number; color: string };

// ─── Asset allocation donut ───────────────────────────────────────────────────

export function AssetAllocationChart({ summary, pieData, chart, fmt }: {
  summary: NetWorthSummary | undefined;
  pieData: PieSlice[];
  chart:   ReturnType<typeof useChartTheme>;
  fmt: (n: number) => string;
}) {
  return (
    <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PremiumIcon icon={PieChart} tone="violet" size="xs" />
          <h3 className="font-semibold text-foreground text-sm">Asset Allocation</h3>
        </div>
        {summary && <span className="text-xs text-muted-foreground/80">{pieData.length} categories</span>}
      </div>
      {pieData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-center">
          <p className="text-sm text-muted-foreground/80">No assets tracked yet</p>
        </div>
      ) : (
        <div className="flex items-start gap-5">
          {/* Donut */}
          <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={82}
                  paddingAngle={2} dataKey="value" stroke="none"
                  activeShape={(props: {
                    cx?: number; cy?: number; innerRadius?: number; outerRadius?: number;
                    startAngle?: number; endAngle?: number; fill?: string;
                  }) => (
                    <Sector
                      cx={props.cx} cy={props.cy}
                      innerRadius={props.innerRadius} outerRadius={(props.outerRadius ?? 0) + 5}
                      startAngle={props.startAngle} endAngle={props.endAngle}
                      fill={props.fill} stroke="none"
                    />
                  )}>
                  {pieData.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={chart.tooltipStyle}
                  labelStyle={chart.labelStyle}
                  itemStyle={chart.itemStyle}
                  wrapperStyle={{ zIndex: 20 }}
                  formatter={(v: number, _: string, props: { payload?: { name?: string } }) => [
                    fmt(v),
                    props.payload?.name ?? "Amount",
                  ]} />
              </RechartsPie>
            </ResponsiveContainer>
            {/* Center label — z-0 keeps it below the Recharts tooltip layer (z-20) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
              <p className="text-xs text-muted-foreground/80 uppercase tracking-wide">Total</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{fmt(summary?.totalAssets ?? 0)}</p>
            </div>
          </div>

          {/* Legend with bars */}
          <div className="flex-1 min-w-0 space-y-2.5 overflow-y-auto max-h-44 pt-1 pr-3 pb-1">
            {pieData.map((s) => {
              const pct = summary?.totalAssets ? (s.value / summary.totalAssets) * 100 : 0;
              return (
                <div key={s.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-xs font-medium text-foreground truncate">{s.name}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-xs font-semibold text-foreground tabular-nums">{pct.toFixed(1)}%</span>
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
      )}
    </div>
  );
}
