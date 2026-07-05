"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart2, ChevronLeft, ChevronRight, Target, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine,
} from "recharts";
import { Header } from "@/components/layout/Header";
import { useAnalytics, useAnnualTrend } from "@/features/analytics/hooks/useAnalytics";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatCurrency, formatCurrencyCompact, cn } from "@/lib/utils";

const COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#06b6d4","#8b5cf6","#ec4899","#14b8a6"];

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
}

function last6Months(year: number, month: number) {
  const result = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i, y = year;
    if (m < 1) { m += 12; y--; }
    result.push({ year: y, month: m, label: new Date(y, m - 1).toLocaleString("en-IN", { month: "short" }) });
  }
  return result;
}

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="animate-pulse flex flex-col gap-2" style={{ height }}>
      <div className="flex items-end gap-2 h-full">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 rounded bg-muted/60"
            style={{ height: `${40 + Math.random() * 50}%` }} />
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const months = last6Months(year, month);
  const chart  = useChartTheme();

  const { data: m0, isLoading: l0 } = useAnalytics(months[0].year, months[0].month);
  const { data: m1, isLoading: l1 } = useAnalytics(months[1].year, months[1].month);
  const { data: m2, isLoading: l2 } = useAnalytics(months[2].year, months[2].month);
  const { data: m3, isLoading: l3 } = useAnalytics(months[3].year, months[3].month);
  const { data: m4, isLoading: l4 } = useAnalytics(months[4].year, months[4].month);
  const { data: m5, isLoading: l5 } = useAnalytics(months[5].year, months[5].month);

  const trendLoading = l0 || l1 || l2 || l3 || l4 || l5;
  const dataPoints = [m0, m1, m2, m3, m4, m5];

  const { data: current }       = useDashboard(year, month);
  const { data: thisYearData }  = useAnnualTrend(year);
  const { data: lastYearData }  = useAnnualTrend(year - 1);

  // Only show months up to the current one for the current year — no future ₹0 bars
  const currentYearCutoff = now.getMonth(); // 0-indexed
  const yearOverYearData = Array.from({ length: 12 }, (_, i) => {
    const label = new Date(year, i).toLocaleString("en-IN", { month: "short" });
    const isFuture = year === now.getFullYear() && i > currentYearCutoff;
    return {
      name:            label,
      [`${year}`]:     isFuture ? null : (thisYearData?.[i]?.expenses ?? 0),
      [`${year - 1}`]: lastYearData?.[i]?.expenses ?? 0,
    };
  });

  const navigate = (dir: -1 | 1) => {
    if (dir === 1 && isCurrentMonth) return;
    let m = month + dir, y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y);
  };

  const trendData = months.map((mo, i) => ({
    name:     mo.label,
    Income:   dataPoints[i]?.monthlyIncome   ?? 0,
    Expenses: dataPoints[i]?.monthlyExpenses  ?? 0,
    Savings:  (dataPoints[i]?.monthlyIncome ?? 0) - (dataPoints[i]?.monthlyExpenses ?? 0),
  }));

  // Allow negative savings rate so overspending months are visible
  const savingsRates = months.map((mo, i) => {
    const income   = dataPoints[i]?.monthlyIncome  ?? 0;
    const expenses = dataPoints[i]?.monthlyExpenses ?? 0;
    const rate     = income > 0 ? ((income - expenses) / income) * 100 : 0;
    return { name: mo.label, Rate: parseFloat(rate.toFixed(1)) };
  });

  const categoryData = current?.categoryBreakdown ?? [];
  const budgetData   = (current?.budgetSummaries ?? []).map(b => ({
    name:     b.categoryName,
    Budgeted: b.budgeted,
    Spent:    b.spent,
    isOver:   b.spent > b.budgeted,
  }));

  const activeMonths = dataPoints.filter(d => d && ((d.monthlyIncome ?? 0) + (d.monthlyExpenses ?? 0)) > 0).length || 1;
  const avgIncome    = trendData.reduce((s, d) => s + d.Income,   0) / activeMonths;
  const avgExpenses  = trendData.reduce((s, d) => s + d.Expenses, 0) / activeMonths;
  const avgSavings   = trendData.reduce((s, d) => s + d.Savings,  0) / activeMonths;
  const avgRate      = savingsRates.reduce((s, d) => s + d.Rate,  0) / activeMonths;

  // Dynamic Y-axis for savings rate — allow negative domain
  const rates      = savingsRates.map(d => d.Rate);
  const minRate    = Math.min(...rates, 0);
  const maxRate    = Math.max(...rates, 10);
  const rateYMin   = minRate < 0 ? Math.floor(minRate * 1.2 / 10) * 10 : 0;
  const rateYMax   = Math.min(100, Math.ceil(maxRate * 1.25 / 10) * 10);

  const summaryCards = [
    { label: "Avg Monthly Income",
      color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/15",
      text: formatCurrencyCompact(avgIncome) },
    { label: "Avg Monthly Expenses",
      color: "text-red-600 dark:text-red-400",         bg: "bg-red-500/8 border-red-500/15",
      text: formatCurrencyCompact(avgExpenses) },
    { label: "Avg Monthly Savings",
      color: avgSavings >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-red-600 dark:text-red-400",
      bg:    avgSavings >= 0 ? "bg-indigo-500/8 border-indigo-500/15" : "bg-red-500/8 border-red-500/15",
      text:  formatCurrencyCompact(avgSavings) },
    { label: "Avg Savings Rate",
      color: avgRate >= 0 ? "text-violet-600 dark:text-violet-400" : "text-red-600 dark:text-red-400",
      bg:    avgRate >= 0 ? "bg-violet-500/8 border-violet-500/15"  : "bg-red-500/8 border-red-500/15",
      text: `${avgRate.toFixed(1)}%` },
  ];

  const hasInvestments = current && (current.totalInvested > 0 || current.totalInvestmentValue > 0);

  return (
    <div className="flex flex-col flex-1 bg-background">
      <Header title="Analytics" />
      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-36 lg:pb-24 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

        {/* Month Navigator */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">6-Month Trend Window</p>
            <p className="text-xs text-muted-foreground/60">Navigating shifts the 6-month window</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-lg bg-muted border border-border hover:bg-muted/80 flex items-center justify-center transition-all">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-24 text-center">{monthLabel(year, month)}</span>
            <button onClick={() => navigate(1)} disabled={isCurrentMonth}
              className="w-8 h-8 rounded-lg bg-muted border border-border hover:bg-muted/80 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {summaryCards.map(({ label, color, bg, text }) => (
            <div key={label} className={cn("rounded-2xl border p-4", bg)}>
              <p className="text-xs text-muted-foreground mb-2">{label}</p>
              {trendLoading
                ? <div className="h-7 w-24 bg-muted/60 rounded-lg animate-pulse mb-1" />
                : <p className={cn("text-xl font-bold tabular-nums", color)}>{text}</p>}
              <p className="text-xs text-muted-foreground/60 mt-1">
                {activeMonths < 6 ? `${activeMonths}-month average` : "6-month average"}
              </p>
            </div>
          ))}
        </div>

        {/* Income vs Expenses Trend */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-1">Income vs Expenses — Last 6 Months</h3>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Last 6 months</p>
          <p className="text-xs text-muted-foreground mb-4 mt-1">
            Savings bar turns red in months where spending exceeded income
          </p>
          {trendLoading ? <ChartSkeleton height={260} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trendData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: chart.axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => formatCurrencyCompact(v)} />
                <Tooltip contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                  cursor={chart.cursorStyle} formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px", color: chart.axisColor }} />
                <ReferenceLine y={0} stroke={chart.gridColor} strokeWidth={1.5} />
                <Bar dataKey="Income"   fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
                <Bar dataKey="Savings"  radius={[4,4,0,0]}>
                  {trendData.map((d, i) => (
                    <Cell key={i} fill={d.Savings >= 0 ? "#6366f1" : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Savings Rate + Category Donut */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-1">Savings Rate Trend</h3>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Last 6 months</p>
            <p className="text-xs text-muted-foreground mb-4 mt-1">
              % of income saved each month — negative means overspending
            </p>
            {trendLoading ? <ChartSkeleton height={200} /> : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={savingsRates}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: chart.axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}%`} domain={[rateYMin, rateYMax]} />
                  <Tooltip contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                    cursor={chart.cursorStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, "Savings Rate"]} />
                  <ReferenceLine y={0} stroke={chart.gridColor} strokeWidth={1.5} />
                  <ReferenceLine y={avgRate} stroke="#8b5cf6" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Line type="monotone" dataKey="Rate" stroke="#8b5cf6" strokeWidth={2.5}
                    dot={{ fill: "#8b5cf6", r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#a78bfa", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-1">Spending by Category</h3>
            <p className="text-xs text-muted-foreground/70 mt-0.5 mb-4">{monthLabel(year, month)} only</p>
            {categoryData.length ? (
              <div className="flex gap-4 items-start">
                <ResponsiveContainer width="45%" height={180}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={68}
                      paddingAngle={2} dataKey="amount">
                      {categoryData.map((c, i) => (
                        <Cell key={i} fill={(c as any).color ?? COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                      formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 pt-1 overflow-y-auto max-h-44 pr-1">
                  {categoryData.slice(0, 10).map((c, i) => (
                    <div key={c.categoryId} className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: (c as any).color ?? COLORS[i % COLORS.length] }} />
                        <span className="text-[11px] text-muted-foreground truncate max-w-[5rem]">{c.categoryName}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-semibold text-foreground tabular-nums">{c.percentage.toFixed(0)}%</span>
                        <span className="text-[10px] text-muted-foreground/60 tabular-nums ml-1">{formatCurrencyCompact((c as any).amount ?? 0)}</span>
                      </div>
                    </div>
                  ))}
                  {categoryData.length > 10 && (
                    <p className="text-[10px] text-muted-foreground/40 pt-1">+{categoryData.length - 10} more</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <BarChart2 className="w-8 h-8 text-muted mb-2" />
                <p className="text-sm text-muted-foreground">No expenses this month</p>
              </div>
            )}
          </div>
        </div>

        {/* Budget Adherence */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-foreground text-sm">Budget Adherence</h3>
            {budgetData.some(b => b.isOver) && (
              <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                {budgetData.filter(b => b.isOver).length} over budget
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{monthLabel(year, month)} only</p>
          <p className="text-xs text-muted-foreground mb-4 mt-1">
            Budgeted vs actual spending for {monthLabel(year, month)} — red bars exceeded the limit
          </p>

          {budgetData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Target className="w-8 h-8 text-muted mb-2" />
              <p className="text-sm font-medium text-foreground">No budgets set for this month</p>
              <p className="text-xs text-muted-foreground/60 mt-1 mb-3">
                Set spending limits per category to track budget adherence here
              </p>
              <Link href="/budgets"
                className="h-8 px-4 rounded-xl text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 transition-all">
                Set up Budgets →
              </Link>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, budgetData.length * 44)}>
              <BarChart data={budgetData} layout="vertical" barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => formatCurrencyCompact(v)} />
                <YAxis type="category" dataKey="name" tick={{ fill: chart.axisColor, fontSize: 11 }}
                  axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                  cursor={chart.cursorStyle} formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: chart.axisColor }} />
                <Bar dataKey="Budgeted" fill={chart.isDark ? "#334155" : "#e2e8f0"} radius={[0,4,4,0]} />
                <Bar dataKey="Spent" radius={[0,4,4,0]}>
                  {budgetData.map((entry, i) => (
                    <Cell key={i} fill={entry.isOver ? "#ef4444" : "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Year-over-Year Comparison */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Year-over-Year Comparison</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monthly expenses: {year} vs {year - 1}
                {year === now.getFullYear() && (
                  <span className="ml-1 text-muted-foreground/50">· {now.toLocaleString("en-IN", { month: "short" })} onwards not yet available</span>
                )}
              </p>
            </div>
            <TrendingUp className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={yearOverYearData} barSize={10} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => formatCurrencyCompact(v)} />
              <Tooltip contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                cursor={chart.cursorStyle}
                formatter={(v: number) => v == null ? ["No data yet", ""] : [formatCurrency(v), ""]} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px", color: chart.axisColor }} />
              <Bar dataKey={String(year)}     fill="#6366f1" radius={[4,4,0,0]} />
              <Bar dataKey={String(year - 1)} fill={chart.isDark ? "#334155" : "#cbd5e1"} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Investment Performance */}
        {hasInvestments ? (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4">Investment Performance</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
              {[
                { label: "Amount Invested", value: current!.totalInvested,
                  color: "text-foreground",                                bg: "bg-muted/60" },
                { label: "Current Value",   value: current!.totalInvestmentValue,
                  color: "text-indigo-600 dark:text-indigo-400",           bg: "bg-indigo-500/8" },
                { label: "Total Returns",   value: current!.totalInvestmentValue - current!.totalInvested,
                  color: current!.totalInvestmentValue >= current!.totalInvested
                    ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                  bg:    current!.totalInvestmentValue >= current!.totalInvested
                    ? "bg-emerald-500/8" : "bg-red-500/8" },
                { label: "Net Worth",       value: current!.totalNetWorth,
                  color: "text-violet-600 dark:text-violet-400",           bg: "bg-violet-500/8" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={cn("rounded-xl border border-border p-3", bg)}>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={cn("text-base font-bold tabular-nums", color)}>{formatCurrency(value)}</p>
                </div>
              ))}
            </div>
            {/* Invested vs Current Value bar comparison */}
            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground mb-3">Invested vs Current Value</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={[
                    { label: "Invested",      value: current!.totalInvested },
                    { label: "Current Value", value: current!.totalInvestmentValue },
                  ]}
                  barCategoryGap="40%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: chart.axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `₹${Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}K`}`} />
                  <Tooltip
                    contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                    cursor={{ fill: "rgba(99,102,241,0.06)" }}
                    formatter={(v: number) => [formatCurrency(v), ""]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {[current!.totalInvested, current!.totalInvestmentValue].map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#94a3b8" : "#6366f1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : current && (
          <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">No investments tracked yet</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                Add stocks, mutual funds, FDs, and gold to see your investment performance here.
              </p>
            </div>
            <Link href="/investments"
              className="shrink-0 h-8 px-4 rounded-xl text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 transition-all whitespace-nowrap">
              Add Investments →
            </Link>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
