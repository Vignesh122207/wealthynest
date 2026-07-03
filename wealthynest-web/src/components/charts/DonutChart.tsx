"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DonutSlice { name: string; value: number; color?: string; }

interface WealthyNestDonutChartProps {
  data:         DonutSlice[];
  height?:      number;
  showLegend?:  boolean;
  innerRadius?: number;
  outerRadius?: number;
}

const COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#06b6d4","#8b5cf6","#ec4899","#14b8a6"];

export function WealthyNestDonutChart({ data, height = 220, showLegend = true, innerRadius = 55, outerRadius = 80 }: WealthyNestDonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={2} dataKey="value">
          {data.map((entry, i) => <Cell key={i} fill={entry.color ?? COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", fontSize: "12px", color: "#f1f5f9" }} />
        {showLegend && <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} iconType="circle" iconSize={8} />}
      </PieChart>
    </ResponsiveContainer>
  );
}
