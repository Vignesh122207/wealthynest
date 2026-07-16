"use client";

import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Receipt } from "lucide-react";
import { monthLabel } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";
import { getCategoryColor, getCategoryIcon } from "@/lib/categoryMeta";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { EmptyState } from "@/components/shared/EmptyState";
import type { CategorySpending } from "@/features/dashboard/types/dashboard.types";

interface SpendingDonutProps {
  categoryBreakdown: CategorySpending[];
  year:              number;
  month:             number;
  chart: {
    tooltipStyle: React.CSSProperties;
    labelStyle:   React.CSSProperties;
    itemStyle:    React.CSSProperties;
  };
  onAddExpense: () => void;
  isLoading:    boolean;
}

export function SpendingDonut({ categoryBreakdown, year, month, chart, onAddExpense, isLoading }: SpendingDonutProps) {
  const label = monthLabel(year, month);
  const { fmt, fmtC } = useAmountFormatter();

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm h-full flex flex-col animate-fade-in-up card-hover">
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

      {isLoading ? (
        <div className="flex-1 min-h-[180px] rounded-2xl shimmer mt-4" />
      ) : categoryBreakdown.length > 0 ? (
        <div className="flex-1 flex flex-col justify-center">
          <div aria-hidden="true">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={categoryBreakdown} cx="50%" cy="50%"
                innerRadius={42} outerRadius={64} paddingAngle={3}
                dataKey="amount" strokeWidth={0}>
                {categoryBreakdown.map((c) => (
                  <Cell key={c.categoryId} fill={getCategoryColor(c.categoryName, c.categoryColor)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={chart.tooltipStyle}
                labelStyle={chart.labelStyle}
                itemStyle={chart.itemStyle}
                formatter={(v: number, _: string, props: { payload?: { categoryName?: string } }) => [
                  fmt(v), props.payload?.categoryName ?? "Amount"
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-3">
            {categoryBreakdown.slice(0, 5).map((c) => {
              const icon  = getCategoryIcon({ name: c.categoryName, icon: c.categoryIcon });
              const color = getCategoryColor(c.categoryName, c.categoryColor);
              return (
              <div key={c.categoryId} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <PremiumIcon icon={icon} hex={color} size="xs" />
                  <span className="text-xs text-muted-foreground truncate">{c.categoryName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                    {fmtC(c.amount)}
                  </span>
                  <span className="text-xs font-semibold text-foreground tabular-nums w-8 text-right">
                    {c.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Receipt}
          title="No expenses this month"
          description="Track your spending to see a category breakdown here."
          action={
            <button onClick={onAddExpense} className="text-xs font-semibold text-primary hover:underline transition-colors">
              Add first expense →
            </button>
          }
          className="flex-1"
        />
      )}
    </div>
  );
}
