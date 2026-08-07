"use client";

import type {ReactNode} from "react";
import {AlertTriangle, CreditCard, Gauge, Lightbulb, PartyPopper, TrendingDown, TrendingUp} from "lucide-react";
import type {LucideIcon} from "lucide-react";
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

// One row per severity, mapping to the icon's tone (matches PremiumIcon's palette). Adding a
// fifth insight kind later means adding one branch below that returns one of these ranks — the
// card shell itself never changes.
const SEVERITY_STYLE: Record<Severity, { tone: IconTone }> = {
  critical:    { tone: "red" },
  warning:     { tone: "red" },
  reminder:    { tone: "yellow" },
  positive:    { tone: "green" },
  opportunity: { tone: "blue" },
};

export interface InsightCard {
  severity: Severity;
  icon:     LucideIcon;
  title:    string;
  body:     ReactNode;
}

interface SmartAlertsRowProps {
  smartInsights: SmartInsight[];
  upcomingBills: Expense[];
}

const MAX_INSIGHTS = 3;

// The anomaly card's body comes verbatim from the server-composed notification message (see
// getAnomalyInsight's comment) so its wording matches the push notification exactly — unlike the
// other two insight kinds, it isn't built as JSX here, so it arrives with no bold markup around
// its currency figures. Highlighting them client-side keeps the shared message text as the single
// source of truth while still matching the other cards' bold-amount styling.
export function highlightAmounts(text: string): ReactNode {
  const parts = text.split(/(₹[\d,]+(?:\.\d+)?)/g);
  return parts.map((part, i) =>
    /^₹[\d,]+(?:\.\d+)?$/.test(part)
      ? <span key={i} className="font-semibold tabular-nums">{part}</span>
      : part
  );
}

// Pure severity-rank sorting front-loads bad news: any month with an anomaly plus a couple of
// upcoming bills already fills every slot before a genuine positive card (a savings-pace win, a
// category actually trending down) ever gets considered, even when one exists in the pool — the
// panel reads as "only warnings" even though the underlying data has good news too. This keeps the
// most urgent items first (critical/warning always win the top slots) but reserves the *last*
// slot for the best available positive/opportunity card when the pure-severity top-N doesn't
// already include one, so the panel stays the intended mix instead of an all-negative feed.
// Falls back to plain severity order when no positive/opportunity candidate exists at all — a
// genuinely all-bad-news month shouldn't have one manufactured.
export function selectTopInsights(sorted: InsightCard[], max: number): InsightCard[] {
  if (sorted.length <= max) return sorted;
  const top = sorted.slice(0, max);
  if (top.some(c => c.severity === "positive" || c.severity === "opportunity")) return top;
  const goodNews = sorted.find(c => c.severity === "positive" || c.severity === "opportunity");
  return goodNews ? [...top.slice(0, max - 1), goodNews] : top;
}

// The Home dashboard's "financial coach" strip — what's happening, why it matters, and what to
// do next, for up to 3 insights at a time, most urgent first. Built entirely from data the page
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
        body: highlightAmounts(insight.message),
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
    };
  });

  const sortedCards = [...fromInsights, ...fromBills]
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const cards = selectTopInsights(sortedCards, MAX_INSIGHTS);

  return (
    <div data-testid="smart-alerts-row" className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm animate-fade-in-up delay-225">
      <div className="flex items-center gap-2 mb-4">
        <PremiumIcon icon={Lightbulb} tone="yellow" size="sm" />
        <h2 className="font-bold text-foreground text-sm">Financial Insights</h2>
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
                className="group flex-1 min-w-60 rounded-xl bg-muted/40 p-3.5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <PremiumIcon icon={card.icon} tone={style.tone} size="xs" interactive />
                  <span className="text-xs font-bold text-foreground/85 leading-tight">{card.title}</span>
                </div>
                <p className="text-xs text-foreground/80 leading-snug">{card.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
