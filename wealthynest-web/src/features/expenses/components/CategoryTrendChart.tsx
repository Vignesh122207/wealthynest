"use client";

import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {useChartTheme} from "@/hooks/useChartTheme";
import {chartValueToNumber} from "@/lib/utils";
import type {CategoryTrendPoint} from "../utils/categoryTrend";

interface CategoryTrendChartProps {
  data: CategoryTrendPoint[];
  fmt: (n: number) => string;
  color: string;
}

/** Small trajectory line chart for one category's monthly spend — the detail drawer's "how has
 * this category trended" view. Reuses the app's shared useChartTheme rather than a one-off style,
 * so it reads as the same visual system as every other chart in the app. */
export function CategoryTrendChart({ data, fmt, color }: CategoryTrendChartProps) {
  const chart = useChartTheme();
  const allZero = data.every(p => p.total === 0);

  if (allZero) {
    return (
      <p className="text-xs text-muted-foreground/70 text-center py-8">
        No spend in this category over the shown period.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: chart.axisColor }}
          axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: chart.axisColor }} axisLine={false} tickLine={false} width={40}
          tickFormatter={(v: number) => fmt(v)} />
        <Tooltip
          contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
          cursor={chart.cursorStyle}
          formatter={(value) => fmt(chartValueToNumber(value))} />
        <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2}
          dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
