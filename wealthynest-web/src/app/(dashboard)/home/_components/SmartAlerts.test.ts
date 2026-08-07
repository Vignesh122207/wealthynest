import {describe, expect, it} from "vitest";
import {isValidElement} from "react";
import {AlertTriangle} from "lucide-react";
import {highlightAmounts, selectTopInsights, type InsightCard} from "./SmartAlerts";

function card(severity: InsightCard["severity"], title: string): InsightCard {
  return { severity, icon: AlertTriangle, title, body: title };
}

describe("selectTopInsights", () => {
  it("returns everything unchanged when there are no more candidates than the cap", () => {
    const cards = [card("critical", "a"), card("warning", "b")];
    expect(selectTopInsights(cards, 3)).toEqual(cards);
  });

  it("keeps plain severity order when the top-N already includes a positive card", () => {
    const cards = [card("critical", "a"), card("positive", "b"), card("warning", "c"), card("reminder", "d")];
    expect(selectTopInsights(cards, 3)).toEqual(cards.slice(0, 3));
  });

  it("swaps the last slot for the best positive card when severity alone would show only bad news", () => {
    // 4 negative/neutral cards outrank a single positive one on pure severity — without the
    // diversity fallback, a 3-cap would show nothing but warnings/reminders even though a genuine
    // positive insight exists in the pool. This is the exact "only negative items" bug.
    const critical = card("critical", "anomaly");
    const warning1 = card("warning", "overspend 1");
    const warning2 = card("warning", "overspend 2");
    const reminder = card("reminder", "bill due");
    const positive = card("positive", "savings pace");
    const sorted = [critical, warning1, warning2, reminder, positive];

    const result = selectTopInsights(sorted, 3);

    expect(result).toEqual([critical, warning1, positive]);
  });

  it("falls back to plain severity order when no positive/opportunity card exists at all", () => {
    // A genuinely all-bad-news month shouldn't have positivity manufactured out of nowhere.
    const cards = [card("critical", "a"), card("warning", "b"), card("warning", "c"), card("reminder", "d")];
    expect(selectTopInsights(cards, 3)).toEqual(cards.slice(0, 3));
  });

  it("never drops the single most urgent (critical) card to make room for good news", () => {
    const critical = card("critical", "anomaly");
    const warning = card("warning", "overspend");
    const positive = card("positive", "savings pace");
    const result = selectTopInsights([critical, warning, positive], 2);
    expect(result[0]).toBe(critical);
    expect(result).toHaveLength(2);
  });
});

describe("highlightAmounts", () => {
  interface SpanProps { children?: string; className?: string; }

  function text(node: ReturnType<typeof highlightAmounts>): string {
    const parts = Array.isArray(node) ? node : [node];
    return parts
      .map((p) => (isValidElement<SpanProps>(p) ? p.props.children : p))
      .join("");
  }

  it("wraps every ₹ amount in a bold span, leaving the rest as plain text", () => {
    const result = highlightAmounts(
      "A Groceries expense of ₹16000 is well above your usual ₹747 for this category — check it's expected."
    ) as unknown[];

    expect(text(result as never)).toBe(
      "A Groceries expense of ₹16000 is well above your usual ₹747 for this category — check it's expected."
    );

    const spans = result.filter(isValidElement) as React.ReactElement<SpanProps>[];
    expect(spans.map((s) => s.props.children)).toEqual(["₹16000", "₹747"]);
    expect(spans.every((s) => s.props.className === "font-semibold tabular-nums")).toBe(true);
  });

  it("handles comma-grouped and decimal amounts", () => {
    const result = highlightAmounts("You spent ₹1,20,000.50 more.") as unknown[];
    const spans = result.filter(isValidElement) as React.ReactElement<SpanProps>[];
    expect(spans.map((s) => s.props.children)).toEqual(["₹1,20,000.50"]);
  });

  it("returns the original text untouched when there are no amounts", () => {
    const result = highlightAmounts("Everything looks fine.");
    expect(text(result as never)).toBe("Everything looks fine.");
  });
});
