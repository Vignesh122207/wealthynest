import {describe, it, expect} from "vitest";
import {resolveGranularityRange, detectActiveGranularity} from "./granularity";

const today = new Date(2026, 7, 7); // Aug 7, 2026 (month is 0-indexed)

describe("resolveGranularityRange", () => {
  it("1M resolves to exactly one month back through today", () => {
    expect(resolveGranularityRange("1M", today)).toEqual({ customStart: "2026-07-07", customEnd: "2026-08-07" });
  });

  it("3M resolves to three months back through today", () => {
    expect(resolveGranularityRange("3M", today)).toEqual({ customStart: "2026-05-07", customEnd: "2026-08-07" });
  });

  it("6M resolves to six months back through today", () => {
    expect(resolveGranularityRange("6M", today)).toEqual({ customStart: "2026-02-07", customEnd: "2026-08-07" });
  });

  it("YTD resolves to Jan 1 of the current year through today", () => {
    expect(resolveGranularityRange("YTD", today)).toEqual({ customStart: "2026-01-01", customEnd: "2026-08-07" });
  });

  it("handles a rolling-month subtraction that would naively overflow (Mar 31 - 1 month)", () => {
    const mar31 = new Date(2026, 2, 31);
    // date-fns subMonths clamps to the last valid day of the target month (Feb 2026 has 28 days),
    // rather than naive Date arithmetic overflowing into March.
    expect(resolveGranularityRange("1M", mar31).customStart).toBe("2026-02-28");
  });
});

describe("detectActiveGranularity", () => {
  it("detects ALL from dateMode alone", () => {
    expect(detectActiveGranularity("all", "", "", today)).toBe("ALL");
  });

  it("detects a rolling range that exactly matches 3M's computed range", () => {
    expect(detectActiveGranularity("custom", "2026-05-07", "2026-08-07", today)).toBe("3M");
  });

  it("detects YTD", () => {
    expect(detectActiveGranularity("custom", "2026-01-01", "2026-08-07", today)).toBe("YTD");
  });

  it("returns null for month mode (no custom range to match against)", () => {
    expect(detectActiveGranularity("month", "", "", today)).toBeNull();
  });

  it("returns null for a custom range that doesn't match any granularity", () => {
    expect(detectActiveGranularity("custom", "2026-03-15", "2026-04-20", today)).toBeNull();
  });
});
