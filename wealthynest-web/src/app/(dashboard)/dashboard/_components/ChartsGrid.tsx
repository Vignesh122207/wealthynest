"use client";

import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Receipt } from "lucide-react";
import { formatCurrency, formatCurrencyCompact, monthLabel } from "@/lib/utils";
import { getCategoryColor, getCategoryMeta } from "@/lib/categoryMeta";
import type { MonthlyTrend, CategorySpending } from "@/features/dashboard/types/dashboard.types";

interface ChartsGridProps {
  trend:             MonthlyTrend[];
  categoryBreakdown: CategorySpending[];
  year:              number;
  month:             number;
  chart:             {
    gridColor:    string;
    axisColor:    string;
    tooltipStyle: React.CSSProperties;
    labelStyle:   React.CSSProperties;
    itemStyle:    React.CSSProperties;
    cursorStyle:  object;
  };
  onAddExpense: () => void;
  isLoading:    boolean;
}

const GRAD_INCOME   = "chartIncomeGrad";
const GRAD_EXPENSES = "chartExpenseGrad";
const GRAD_SAVED    = "chartSavedGrad";

export function ChartsGrid({
  trend, categoryBreakdown, year, month, chart, onAddExpense, isLoading,
}: ChartsGridProps) {
  const label = monthLabel(year, month);

  if (isLoading) {
    return (
      <div className="grid lg:grid-cols-3 gap-4 animate-fade-in-up delay-375">
        <div className="lg:col-span-2 h-64 rounded-2xl shimmer" />
        <div className="h-64 rounded-2xl shimmer" />
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4 animate-fade-in-up delay-375">

      {/* ── 6-Month Area Trend ── */}
      {trend.length > 0 && (
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-bold text-foreground text-sm">6-Month Trend</h3>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">Income · Expenses · Savings</p>
            </div>
          </div>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trend} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id={GRAD_INCOME} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={GRAD_EXPENSES} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={GRAD_SAVED} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: chart.axisColor, fontSize: 10, fontWeight: 500 }}
                  axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => formatCurrencyCompact(v)} width={50} />
                <Tooltip
                  contentStyle={chart.tooltipStyle}
                  labelStyle={chart.labelStyle}
                  itemStyle={chart.itemStyle}
                  cursor={chart.cursorStyle}
                  formatter={(v: number, name: string) => [formatCurrency(v), name]}
                />
                <Legend iconType="circle" iconSize={6}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: chart.axisColor }} />
                <Area type="monotone" dataKey="income"   name="Income"
                  stroke="#22c55e" strokeWidth={2} fill={`url(#${GRAD_INCOME})`} dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="expenses" name="Expenses"
                  stroke="#f43f5e" strokeWidth={2} fill={`url(#${GRAD_EXPENSES})`} dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="saved"    name="Saved"
                  stroke="#818cf8" strokeWidth={2} fill={`url(#${GRAD_SAVED})`}    dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Spending Donut ── */}
      <div className={`bg-card border border-border/50 rounded-2xl p-5 shadow-sm flex flex-col ${trend.length === 0 ? "lg:col-span-3" : ""}`}>
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="font-bold text-foreground text-sm">Spending</h3>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">By category · {label}</p>
          </div>
          <Link href="/expenses"
            className="text-[11px] font-semibold text-primary hover:underline transition-colors">
            See all →
          </Link>
        </div>

        {categoryBreakdown.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={categoryBreakdown} cx="50%" cy="50%"
                  innerRadius={38} outerRadius={58} paddingAngle={3}
                  dataKey="amount" strokeWidth={0}>
                  {categoryBreakdown.map((c) => (
                    <Cell key={c.categoryId} fill={getCategoryColor(c.categoryName, c.categoryColor)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={chart.tooltipStyle}
                  labelStyle={chart.labelStyle}
                  itemStyle={chart.itemStyle}
                  formatter={(v: number, _: string, props: any) => [
                    formatCurrency(v), props?.payload?.categoryName ?? "Amount"
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {categoryBreakdown.slice(0, 5).map((c) => {
                const meta  = getCategoryMeta(c.categoryName);
                const color = getCategoryColor(c.categoryName, c.categoryColor);
                const Icon  = meta.icon;
                return (
                <div key={c.categoryId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color + "20" }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={1.75} />
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{c.categoryName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                      {formatCurrencyCompact(c.amount)}
                    </span>
                    <span className="text-xs font-semibold text-foreground tabular-nums w-8 text-right">
                      {c.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 py-8 gap-2 text-center">
            <Receipt className="w-9 h-9 text-muted-foreground/25 mb-1" />
            <p className="text-sm font-medium text-foreground">No expenses this month</p>
            <button onClick={onAddExpense}
              className="text-xs text-primary hover:underline transition-colors">
              Add first expense →
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
