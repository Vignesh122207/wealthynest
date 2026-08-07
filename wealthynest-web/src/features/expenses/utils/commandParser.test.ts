import {describe, it, expect} from "vitest";
import {parseCommand} from "./commandParser";

const categories = [
  { id: "c1", name: "Groceries" },
  { id: "c2", name: "Dining" },
  { id: "c3", name: "Travel" },
];

describe("parseCommand", () => {
  it("returns an empty result (no matched terms) for a blank query", () => {
    expect(parseCommand("", categories).matchedTerms).toEqual([]);
    expect(parseCommand("   ", categories).matchedTerms).toEqual([]);
  });

  it("parses the example prompt: category alias + rolling range + both income and spending -> All tab", () => {
    const result = parseCommand("Show me food spending trends over the last 3 months compared to income", categories);

    expect(result.granularity).toBe("3M");
    // "food" alias group includes "grocery"/"groceries" — "Groceries" is the first category (in
    // array order) whose name contains one of that group's substrings.
    expect(result.categoryName).toBe("Groceries");
    expect(result.txType).toBe("all"); // both spending and income mentioned
    expect(result.matchedTerms.length).toBeGreaterThan(0);
  });

  it("matches a category by its literal name even without an alias", () => {
    const result = parseCommand("how much did I spend on travel", categories);
    expect(result.categoryId).toBe("c3");
    expect(result.categoryName).toBe("Travel");
  });

  it("recognizes YTD phrasing", () => {
    expect(parseCommand("spending year to date", categories).granularity).toBe("YTD");
    expect(parseCommand("ytd spending", categories).granularity).toBe("YTD");
  });

  it("recognizes all-time phrasing", () => {
    expect(parseCommand("all time expenses", categories).granularity).toBe("ALL");
  });

  it("snaps an arbitrary month count to the nearest supported bucket", () => {
    expect(parseCommand("last 1 month", categories).granularity).toBe("1M");
    expect(parseCommand("last 2 months", categories).granularity).toBe("3M");
    expect(parseCommand("last 4 months", categories).granularity).toBe("6M");
  });

  it("only sets txType to income when income is mentioned without spending", () => {
    const result = parseCommand("show my income this month", categories);
    expect(result.txType).toBe("income");
    expect(result.granularity).toBe("1M");
  });

  it("detects a recurring-only request", () => {
    expect(parseCommand("show recurring expenses", categories).recurringOnly).toBe(true);
  });

  it("sets nothing (no false positives) for an unrelated query", () => {
    const result = parseCommand("hello there", categories);
    expect(result.granularity).toBeUndefined();
    expect(result.categoryId).toBeUndefined();
    expect(result.txType).toBeUndefined();
    expect(result.recurringOnly).toBeUndefined();
  });
});
