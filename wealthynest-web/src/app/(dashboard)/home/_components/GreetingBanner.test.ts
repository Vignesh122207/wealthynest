import {describe, expect, it} from "vitest";
import {getSavingsInsight} from "./GreetingBanner";

describe("getSavingsInsight", () => {
  it("returns null when savingsRate is not yet loaded", () => {
    expect(getSavingsInsight(5000, 1000, undefined)).toBeNull();
  });

  it("returns null when there's no income and no expenses this month", () => {
    expect(getSavingsInsight(0, 0, 0)).toBeNull();
    expect(getSavingsInsight(undefined, undefined, 0)).toBeNull();
  });

  it("warns when expenses were logged against zero income, instead of staying silent", () => {
    expect(getSavingsInsight(0, 5000, 0)).toBe("No income logged this month, but ₹5,000 in expenses — that's coming out of savings.");
  });

  it("distinguishes an exact break-even month from a genuine overspend", () => {
    expect(getSavingsInsight(1000, 1000, 0)).toBe("You spent exactly what you earned this month — nothing left over.");
    expect(getSavingsInsight(1000, 1200, -20)).toBe("Expenses exceeded income by 20% this month.");
  });

  it("tiers positive savings rates", () => {
    expect(getSavingsInsight(1000, 550, 45)).toBe("Outstanding savings rate. You're building real wealth!");
    expect(getSavingsInsight(1000, 700, 30)).toBe("Strong savings discipline. Keep the momentum going.");
    expect(getSavingsInsight(1000, 800, 20)).toBe("Good progress. A little more savings each month adds up fast.");
    expect(getSavingsInsight(1000, 900, 10)).toBe("You're saving something — let's work on growing that.");
    expect(getSavingsInsight(1000, 980, 2)).toBe("Small wins count. Try to cut one expense this week.");
  });
});
