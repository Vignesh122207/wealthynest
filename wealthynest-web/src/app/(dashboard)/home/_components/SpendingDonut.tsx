"use client";

import Link from "next/link";
import {Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipValueType} from "recharts";
import {Receipt} from "lucide-react";
import {chartValueToNumber, monthLabel} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {getCategoryColor, getCategoryIcon} from "@/lib/categoryMeta";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {EmptyState} from "@/components/shared/EmptyState";
import type {CategorySpending} from "@/features/dashboard/types/dashboard.types";

interface SpendingDonutProps {
  categoryBreakdown: CategorySpending[];
  year:              number;
  month:             number;
  /** There's no annual category-breakdown endpoint yet — this widget always shows a single
   * month's data. Month mode's label already says which month; Year mode needs to say so
   * explicitly too, since every sibling widget on the page (StatOverview, SixMonthTrend,
   * BudgetSection) does switch to year-scoped figures when this toggles, so silently continuing
   * to show one month's breakdown here without a label change reads as broken, not as scoped. */
  viewMode: "month" | "year";
  chart: {
    tooltipStyle: React.CSSProperties;
    labelStyle:   React.CSSProperties;
    itemStyle:    React.CSSProperties;
  };
  onAddExpense: () => void;
  isLoading:    boolean;
}

export function SpendingDonut({ categoryBreakdown, year, month, viewMode, chart, onAddExpense, isLoading }: SpendingDonutProps) {
  const label = monthLabel(year, month);
  const { fmt, fmtC } = useAmountFormatter();
  // Plain const, not useMemo — same rationale as page.tsx's own "cheap array/arithmetic work"
  // comment: categoryBreakdown never exceeds a couple dozen rows, so summing it every render costs
  // nothing worth memoizing against.
  const total = categoryBreakdown.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="bg-card rounded-xl shadow-soft dark:shadow-none dark:border dark:border-border/50 p-5 h-full flex flex-col animate-fade-in-up card-hover">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="font-bold text-foreground text-sm">Spending</h2>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">
            By category · {label}{viewMode === "year" && " only"}
          </p>
        </div>
        <Link href="/expenses"
          className="text-[11px] font-semibold text-primary hover:underline transition-colors">
          See all →
        </Link>
      </div>

      {isLoading ? (
        <div className="flex-1 min-h-[180px] rounded-2xl shimmer mt-4" />
      ) : categoryBreakdown.length > 0 ? (
        <div className="flex-1 flex items-center gap-4">
          {/* accessibilityLayer={false} on the chart handles the outer <svg role="application">
              (see SixMonthTrend.tsx's identical wrapper), but <Pie> independently puts its own
              tabindex="0" on its rendered <g class="recharts-pie"> layer for slice-level keyboard
              nav — a second, separate focusable element inside this same aria-hidden div. That
              layer reads its own `rootTabIndex` prop (default 0), not `tabIndex` — passing
              tabIndex={-1} here is a no-op since <Pie> doesn't forward an unrecognized prop;
              confirmed still failing axe in CI with rootTabIndex still defaulted to 0. */}
          <div className="relative w-[136px] h-[136px] shrink-0" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer={false}>
              <Pie data={categoryBreakdown} cx="50%" cy="50%"
                innerRadius={48} outerRadius={68} paddingAngle={3}
                dataKey="amount" strokeWidth={0} rootTabIndex={-1}>
                {categoryBreakdown.map((c) => (
                  <Cell key={c.categoryId} fill={getCategoryColor(c.categoryName, c.categoryColor)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={chart.tooltipStyle}
                labelStyle={chart.labelStyle}
                itemStyle={chart.itemStyle}
                formatter={(v: TooltipValueType | undefined, _: number | string | undefined, props: { payload?: { categoryName?: string } }) => [
                  fmt(chartValueToNumber(v)), props.payload?.categoryName ?? "Amount"
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center total — redundant with the Monthly Expenses stat tile above, so this stays
              inside the same aria-hidden block as the chart rather than adding a second live
              reading of the same figure. pointer-events-none so it never intercepts the Pie's own
              hover/tooltip target underneath it. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-wide">Total</span>
            <span className="text-sm font-bold text-foreground tabular-nums tracking-tight">{fmtC(total)}</span>
          </div>
          </div>
          <div className="space-y-1.5 min-w-0 flex-1">
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
                  <span className="text-[11px] text-muted-foreground/80 tabular-nums">
                    {fmtC(c.amount)}
                  </span>
                  <span className="text-xs font-semibold text-foreground tabular-nums w-8 text-right">
                    {c.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
              );
            })}
            {/* The pie above plots every category — this list caps at 5 to keep the card a fixed
                height, which otherwise leaves categories 6+ as colored slices with no label
                anywhere in the widget. */}
            {categoryBreakdown.length > 5 && (
              <p className="text-[11px] text-muted-foreground/70 text-center pt-0.5">
                +{categoryBreakdown.length - 5} more {categoryBreakdown.length - 5 === 1 ? "category" : "categories"}
              </p>
            )}
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
