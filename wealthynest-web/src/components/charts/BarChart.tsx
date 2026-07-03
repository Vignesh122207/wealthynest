"use client";

import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

interface BarDataPoint { label: string; value: number; color?: string; }

interface WealthyNestBarChartProps {
  data:      BarDataPoint[];
  color?:    string;
  height?:   number;
  currency?: boolean;
  radius?:   number;
}

export function WealthyNestBarChart({ data, color = "#6366f1", height = 200, currency = true, radius = 6 }: WealthyNestBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={60}
          tickFormatter={(v) => currency ? formatCurrencyCompact(v) : String(v)} />
        <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", fontSize: "12px", color: "#f1f5f9" }}
          formatter={(v: number) => currency ? [formatCurrency(v), ""] : [v, ""]}
          cursor={{ fill: "#334155", opacity: 0.3 }} />
        <Bar dataKey="value" radius={[radius, radius, 0, 0]}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color ?? color} />)}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
