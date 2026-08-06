"use client";

import type {LucideIcon} from "lucide-react";
import {AlertTriangle, Calendar, Gauge, TrendingDown, TrendingUp} from "lucide-react";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {type IconTone} from "@/components/icons/PremiumIcon";
import {FlatIcon} from "@/components/icons/FlatIcon";
import type {Expense} from "@/features/expenses/types/expense.types";

// Category-delta insights work for any browsed month; the other two (forecast/anomaly) are
// only ever built by the caller for the current month — see page.tsx's isCurrentMonth gate.
// `projected` on "delta" is true when it's a pace-projected full-month estimate for the
// in-progress month rather than a completed-month actual — see getCategoryDeltaInsights.
export type SmartInsight =
  | { kind: "delta";    category: string; delta: number; projected: boolean }
  | { kind: "forecast"; amount: number; pctVsAvg: number | null }
  | { kind: "anomaly";  title: string; message: string };

// One bordered card per insight/bill — each stands alone rather than being grouped inside a
// shared "Smart Insights" / "Upcoming Bills" box, so the rail reads as a set of individual,
// scannable facts instead of two paragraphs of prose.
function InsightCard({ testId, icon, tone, title, children }: {
  testId: string; icon: LucideIcon; tone: IconTone; title: string; children: React.ReactNode;
}) {
  return (
    <div data-testid={testId}
      className="flex-1 min-w-[220px] sm:min-w-0 rounded-2xl border border-border/50 bg-card p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <FlatIcon icon={icon} tone={tone} size="xs" />
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

function InsightItemCard({ insight }: { insight: SmartInsight }) {
  const { fmt } = useAmountFormatter();

  if (insight.kind === "anomaly") {
    return (
      <InsightCard testId="smart-insight-card" icon={AlertTriangle} tone="red" title={insight.title}>
        {insight.message}
      </InsightCard>
    );
  }

  if (insight.kind === "forecast") {
    const good = insight.pctVsAvg == null || insight.pctVsAvg <= 0;
    return (
      <InsightCard testId="smart-insight-card" icon={Gauge} tone={good ? "green" : "yellow"} title="On pace to save">
        At this rate you&apos;ll save ~<span className="font-semibold tabular-nums text-foreground">{fmt(insight.amount)}</span> this month
        {insight.pctVsAvg != null && (
          <> — <span className="font-semibold text-foreground">
            {Math.abs(Math.round(insight.pctVsAvg))}% {insight.pctVsAvg >= 0 ? "above" : "below"}
          </span> your 6-month average</>
        )}.
      </InsightCard>
    );
  }

  const up = insight.delta > 0;
  const verb = insight.projected ? "on pace to spend" : "spent";
  return (
    <InsightCard testId="smart-insight-card" icon={up ? TrendingUp : TrendingDown} tone={up ? "yellow" : "green"}
      title={`${insight.category} is ${up ? "up" : "down"}`}>
      You&apos;re {verb} <span className="font-semibold tabular-nums text-foreground">{fmt(Math.abs(insight.delta))}</span> {up ? "more" : "less"} on{" "}
      {insight.category.toLowerCase()} than last month.
    </InsightCard>
  );
}

function BillCard({ bill }: { bill: Expense }) {
  const { fmt } = useAmountFormatter();
  const label = bill.description || bill.categoryName || "Recurring";
  const dayName = new Date(bill.expenseDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return (
    <InsightCard testId="smart-bill-card" icon={Calendar} tone="orange" title={`Upcoming — ${label}`}>
      <span className="font-semibold tabular-nums text-foreground">{fmt(bill.amount)}</span> is due {dayName}.
    </InsightCard>
  );
}

interface SmartAlertsRowProps {
  smartInsights: SmartInsight[];
  upcomingBills: Expense[];
}

// One horizontal rail of small cards — insights first, then bills — instead of two grouped
// boxes. Scrolls on mobile where four cards don't fit; shares the row evenly from sm up.
export function SmartAlertsRow({ smartInsights, upcomingBills }: SmartAlertsRowProps) {
  if (smartInsights.length === 0 && upcomingBills.length === 0) return null;

  return (
    <div data-testid="smart-alerts-row" className="animate-fade-in-up delay-225">
      <p className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wide mb-2 px-0.5">
        Smart Insights
      </p>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {smartInsights.map((insight, i) => <InsightItemCard key={i} insight={insight} />)}
        {upcomingBills.slice(0, 4).map((bill) => <BillCard key={bill.id} bill={bill} />)}
      </div>
    </div>
  );
}
