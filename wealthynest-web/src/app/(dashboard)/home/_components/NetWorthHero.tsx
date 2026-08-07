"use client";

import Link from "next/link";
import {Area, AreaChart, ResponsiveContainer, Tooltip, type TooltipValueType} from "recharts";
import {Landmark} from "lucide-react";
import {chartValueToNumber, cn, formatTrendDelta} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {CHART_COLORS} from "@/lib/chartColors";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import type {NetWorthHistoryPoint} from "@/features/networth/types/networth.types";

interface NetWorthHeroProps {
  netWorth:    number | undefined;
  /** Month mode: month-over-month change. Year mode: change since Jan 1 (pass changeLabel="since Jan 1"). */
  changePct:   number | undefined;
  changeLabel?: string;
  history:     NetWorthHistoryPoint[];
  chart: {
    tooltipStyle: React.CSSProperties;
    labelStyle:   React.CSSProperties;
    itemStyle:    React.CSSProperties;
  };
  isLoading: boolean;
}

const GRAD_ID = "homeHeroNwGrad";

// The page's one unambiguous focal point — pulled out of StatOverview's tile grid so the most
// important number on Home doesn't have to compete for attention against five same-shaped tiles
// (see the design review this responds to). Big figure + a chrome-free sparkline (no axes/grid/
// legend, unlike the full NetWorthTrend chart it replaces) — detail lives one tap away on /assets,
// which already renders the full NetWorthHistoryChart from the same history data.
export function NetWorthHero({ netWorth, changePct, changeLabel, history, chart, isLoading }: NetWorthHeroProps) {
  const { fmt } = useAmountFormatter();
  const isPositive = changePct != null ? changePct >= 0 : undefined;

  if (isLoading) {
    return (
      <div className="rounded-2xl p-5 sm:p-6 bg-primary/[0.045] dark:bg-primary/[0.07] border border-primary/25 shadow-soft dark:shadow-none animate-fade-in-up">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-xl shimmer" />
          <div className="h-4 w-24 rounded shimmer" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="h-11 w-56 rounded-xl shimmer" />
          <div className="h-20 w-full sm:w-64 lg:w-72 rounded-xl shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="net-worth-hero" className="rounded-2xl p-5 sm:p-6 bg-primary/[0.045] dark:bg-primary/[0.07] border border-primary/25 shadow-soft dark:shadow-none animate-fade-in-up">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <PremiumIcon icon={Landmark} tone="blue" size="sm" />
          <h2 className="font-bold text-foreground text-sm">Net Worth</h2>
        </div>
        <Link href="/assets" className="text-xs font-semibold text-primary hover:underline transition-colors">
          View all →
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="min-w-0">
          <p data-testid="net-worth-hero-value" className="text-4xl sm:text-5xl font-extrabold text-foreground tabular-nums tracking-tight leading-none">
            {netWorth != null ? fmt(netWorth) : "—"}
          </p>
          {changePct != null && (
            <div className={cn(
              "inline-flex items-center mt-3 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums",
              isPositive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500 dark:text-red-400"
            )}>
              {formatTrendDelta(changePct, changeLabel)}
            </div>
          )}
        </div>

        <div className="w-full sm:w-64 lg:w-72 h-20 shrink-0">
          {history.length > 1 ? (
            /* aria-hidden on the wrapper alone isn't enough — Recharts adds its own keyboard-nav
               layer (role="application" tabindex="0" on the inner <svg>) by default, which axe
               flags as a real WCAG violation ("aria-hidden-focus": a focusable element can't sit
               inside an aria-hidden subtree). accessibilityLayer={false} turns that default off to
               match this chart's own already-decorative intent — same fix every Recharts instance
               on Home applies (see SpendingDonut.tsx/InvestmentPanel.tsx for the <Pie>-specific
               follow-on issue that alone doesn't fully solve). */
            <div className="w-full h-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ left: 0, right: 0, top: 4, bottom: 0 }} accessibilityLayer={false}>
                  <defs>
                    <linearGradient id={GRAD_ID} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                    formatter={(v: TooltipValueType | undefined) => [fmt(chartValueToNumber(v)), "Net Worth"]}
                  />
                  <Area type="monotone" dataKey="netWorth" stroke={CHART_COLORS.primary} strokeWidth={2.5}
                    fill={`url(#${GRAD_ID})`} dot={false} activeDot={{ r: 4, fill: "#a78bfa", strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center rounded-xl bg-primary/5 border border-primary/10 px-3">
              <p className="text-xs text-muted-foreground/70 text-center">
                History builds over time — a snapshot is taken automatically on the 1st.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
