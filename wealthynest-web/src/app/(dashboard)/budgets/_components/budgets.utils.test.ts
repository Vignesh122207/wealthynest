import {describe, expect, it} from "vitest";
import {getMonthsElapsedInYear} from "./budgets.utils";

describe("getMonthsElapsedInYear", () => {
  it("returns the full 12 for a fully-elapsed past year", () => {
    expect(getMonthsElapsedInYear(2025, new Date(2026, 6, 15))).toBe(12);
  });

  it("returns the current month number (1-indexed) for the current year", () => {
    expect(getMonthsElapsedInYear(2026, new Date(2026, 0, 15))).toBe(1);
    expect(getMonthsElapsedInYear(2026, new Date(2026, 6, 1))).toBe(7);
    expect(getMonthsElapsedInYear(2026, new Date(2026, 11, 31))).toBe(12);
  });

  it("returns 0 for a year that hasn't started yet", () => {
    expect(getMonthsElapsedInYear(2027, new Date(2026, 6, 15))).toBe(0);
  });
});
