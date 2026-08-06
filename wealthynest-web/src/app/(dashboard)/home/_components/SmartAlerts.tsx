"use client";

import type {ReactNode} from "react";
import Link from "next/link";
import {AlertTriangle, CreditCard, Gauge, Lightbulb, PartyPopper, TrendingDown, TrendingUp} from "lucide-react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {PremiumIcon, type IconTone} from "@/components/icons/PremiumIcon";
import {EmptyState} from "@/components/shared/EmptyState";
import type {Expense} from "@/features/expenses/types/expense.types";

// Category-delta insights work for any browsed month; the other two (forecast/anomaly) are
// only ever built by the caller for the current month — see page.tsx's isCurrentMonth gate.
// `projected` on "delta" is true when it's a pace-projected full-month estimate for the
// in-progress month rather than a completed-month actual — see getCategoryDeltaInsights.
export type SmartInsight =
  | { kind: "delta";    category: string; delta: number; projected: boolean }
  | { kind: "forecast"; amount: number; pctVsAvg: number | null }
  | { kind: "anomaly";  title: string; message: string };

// Five ranks, not just four colors — "critical" (a server-detected anomaly) and "warning"
// (overspending, a bill due imminently) both read red, but critical always sorts first. Kept
// as its own rank so a future insight producer (see FUTURE READY note below) can slot in at the
// right urgency without redefining how the others sort.
type Severity = "critical" | "warning" | "reminder" | "positive" | "opportunity";

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0, warning: 1, reminder: 2, positive: 3, opportunity: 4,
};

// One row per severity: icon tone (matches PremiumIcon's palette), tinted card background, and
// the left accent border in its resting/hover strength. Adding a fifth insight kind later means
// adding one branch below that returns one of these ranks — the card shell itself never changes.
// `group-hover:` deliberately isn't used for the border here — that variant only matches
// descendants of a hovered `.group`, never the group element itself, so it would've been a
// silent no-op on the card div that carries `group`. Plain `hover:` on the same element is what
// actually fires; `group` stays on the card purely so the nested PremiumIcon (a real descendant)
// can react to `group-hover:` for its own lift/scale.
const SEVERITY_STYLE: Record<Severity, { tone: IconTone; bg: string; border: string; borderHover: string }> = {
  critical:    { tone: "red",    bg: "bg-red-500/[0.06]",     border: "border-l-red-500/70",     borderHover: "hover:border-l-red-500" },
  warning:     { tone: "red",    bg: "bg-red-500/[0.06]",     border: "border-l-red-500/70",     borderHover: "hover:border-l-red-500" },
  reminder:    { tone: "yellow", bg: "bg-amber-500/[0.06]",   border: "border-l-amber-500/70",   borderHover: "hover:border-l-amber-500" },
  positive:    { tone: "green",  bg: "bg-emerald-500/[0.06]", border: "border-l-emerald-500/70", borderHover: "hover:border-l-emerald-500" },
  opportunity: { tone: "blue",   bg: "bg-blue-500/[0.06]",    border: "border-l-blue-500/70",    borderHover: "hover:border-l-blue-500" },
};

interface InsightCard {
  severity: Severity;
  icon:     LucideIcon;
  title:    string;
  body:     ReactNode;
  action?:  { label: string; href: string };
}

interface SmartAlertsRowProps {
  smartInsights: SmartInsight[];
  upcomingBills: Expense[];
}

const MAX_INSIGHTS = 4;

// The Home dashboard's "financial coach" strip — what's happening, why it matters, and what to
// do next, for up to 4 insights at a time, most urgent first. Built entirely from data the page
// already computes (spending deltas, the pace forecast, server anomalies, upcoming recurring
// bills) — no new endpoint, no new field.
export function SmartAlertsRow({ smartInsights, upcomingBills }: SmartAlertsRowProps) {
  const { fmt } = useAmountFormatter();

  const fromInsights: InsightCard[] = smartInsights.map((insight): InsightCard => {
    if (insight.kind === "anomaly") {
      return {
        severity: "critical",
        icon: AlertTriangle,
        title: insight.title,
        body: insight.message,
        action: { label: "View transactions", href: "/expenses" },
      };
    }
    if (insight.kind === "forecast") {
      // Sign of the projected amount rules first — a projected deficit (expenses outrunning
      // income) is bad regardless of how it compares to prior months. Only once the projection
      // is actually positive does pctVsAvg get a say — a *higher* projected save than the prior
      // average is what "good" means (pctVsAvg is (projected - avg) / |avg|, so above-average
      // saving is pctVsAvg >= 0, not <= 0 — this was inverted before and let a deficit that
      // merely looked "below average" read as "Excellent savings pace").
      const deficit      = insight.amount < 0;
      const belowAverage = insight.pctVsAvg != null && insight.pctVsAvg < 0;
      const severity: Severity = deficit ? "warning" : belowAverage ? "reminder" : "positive";
      return {
        severity,
        icon: Gauge,
        title: deficit ? "On pace to overspend this month" : belowAverage ? "Savings pace slipping" : "Excellent savings pace",
        body: deficit ? (
          <>
            You&apos;re projected to spend <span className="font-semibold tabular-nums">{fmt(Math.abs(insight.amount))}</span> more than you earn this month.
          </>
        ) : (
          <>
            You&apos;re projected to save <span className="font-semibold tabular-nums">{fmt(insight.amount)}</span> this month
            {insight.pctVsAvg != null && (
              <> — {Math.abs(Math.round(insight.pctVsAvg))}% {insight.pctVsAvg >= 0 ? "above" : "below"} your usual pace</>
            )}.
          </>
        ),
        // Budgets shows spend-vs-limit broken out by category — a better landing spot for "go
        // figure out where to cut back" than a flat transaction list. Category-specific delta
        // insights below still send you to /expenses, since there you genuinely want that one
        // category's transactions, not the whole budget picture.
        action: deficit || belowAverage
          ? { label: "Review spending", href: "/budgets" }
          : { label: "Keep it up", href: "/goals" },
      };
    }
    // getCategoryDeltaInsights compares this month's (or its pace-projection, mid-month) spend
    // against last month specifically — not a rolling average — so the copy says "than last
    // month", not "than usual", to match what's actually being compared. And the subject/verb
    // has to track `projected` on its own, independent of `up`/`down`: a still-in-progress
    // month's pace-projected amount isn't a completed fact yet ("You're on pace to spend..."),
    // while a closed month's real total is ("You spent...") — conflating the two previously let
    // a projected *under*spend get worded as if it had already happened.
    const up = insight.delta > 0;
    return {
      severity: up ? "warning" : "positive",
      icon: up ? TrendingUp : TrendingDown,
      title: `${insight.category} spending ${up ? "higher than usual" : "is down"}`,
      body: insight.projected ? (
        <>
          You&apos;re on pace to spend <span className="font-semibold tabular-nums">{fmt(Math.abs(insight.delta))}</span> {up ? "more" : "less"} on{" "}
          <span className="font-semibold">{insight.category}</span> than last month.
        </>
      ) : (
        <>
          You spent <span className="font-semibold tabular-nums">{fmt(Math.abs(insight.delta))}</span> {up ? "more" : "less"} on{" "}
          <span className="font-semibold">{insight.category}</span> than last month.
        </>
      ),
      action: up
        ? { label: "View transactions", href: "/expenses" }
        : { label: "Keep it up", href: "/budgets" },
    };
  });

  const fromBills: InsightCard[] = upcomingBills.map((bill): InsightCard => {
    const due   = new Date(bill.expenseDate);
    const today = new Date();
    const dueMidnight   = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    // Query bounds this to [today, today+7], but guard the label anyway rather than let a
    // negative daysLeft (a timezone edge case, a clock skew) silently read as "due today".
    const daysLeft   = Math.round((dueMidnight - todayMidnight) / 86_400_000);
    const isOverdue  = daysLeft < 0;
    const whenLabel  = isOverdue ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago`
      : daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
    const dueWord    = isOverdue ? "overdue" : daysLeft === 0 ? "due today" : daysLeft === 1 ? "due tomorrow" : "due soon";
    const name = bill.description || bill.categoryName || "Recurring payment";
    return {
      severity: daysLeft <= 1 ? "warning" : "reminder",
      icon: CreditCard,
      title: `${name} ${dueWord}`,
      body: (
        <>
          Your <span className="font-semibold">{name}</span> payment of{" "}
          <span className="font-semibold tabular-nums">{fmt(bill.amount)}</span> {isOverdue ? "was due" : "is due"} {whenLabel}.
        </>
      ),
      action: { label: "Pay now", href: "/expenses" },
    };
  });

  const cards = [...fromInsights, ...fromBills]
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, MAX_INSIGHTS);

  return (
    <div data-testid="smart-alerts-row" className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-225">
      <div className="flex items-center gap-2 mb-4">
        <PremiumIcon icon={Lightbulb} tone="yellow" size="sm" />
        <h2 className="font-bold text-foreground">Financial Insights</h2>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          tone="green"
          title="Everything looks great! 🎉"
          description="No important actions are needed right now. We'll notify you when something requires your attention."
          className="py-8"
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          {cards.map((card, i) => {
            const style = SEVERITY_STYLE[card.severity];
            return (
              <div
                key={i}
                data-testid="smart-insight-card"
                className={cn(
                  "group flex-1 min-w-60 rounded-xl border-l-4 p-3.5 shadow-sm transition-all duration-200",
                  "hover:shadow-md hover:-translate-y-0.5",
                  style.bg, style.border, style.borderHover,
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <PremiumIcon icon={card.icon} tone={style.tone} size="xs" interactive />
                  <span className="text-[11px] font-bold text-foreground/85 leading-tight">{card.title}</span>
                </div>
                <p className="text-xs text-foreground/80 leading-snug">{card.body}</p>
                {card.action && (
                  <Link
                    href={card.action.href}
                    className="mt-2 inline-block text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    {card.action.label} →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
