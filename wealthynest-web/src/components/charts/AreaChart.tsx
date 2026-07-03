"use client";

import {
  AreaChart as RechartsAreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

interface DataPoint { label: string; value: number; [key: string]: string | number; }

interface WealthyNestAreaChartProps {
  data:       DataPoint[];
  dataKey?:   string;
  color?:     string;
  height?:    number;
  currency?:  boolean;
}

export function WealthyNestAreaChart({ data, dataKey = "value", color = "#6366f1", height = 200, currency = true }: WealthyNestAreaChartProps) {
  const gradId = `grad-${dataKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={60}
          tickFormatter={(v) => currency ? formatCurrencyCompact(v) : String(v)} />
        <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", fontSize: "12px", color: "#f1f5f9" }}
          formatter={(v: number) => currency ? [formatCurrency(v), ""] : [v, ""]} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2}
          fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4, fill: color, strokeWidth: 0 }} />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
