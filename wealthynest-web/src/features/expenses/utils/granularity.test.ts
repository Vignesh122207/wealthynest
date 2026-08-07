import {describe, it, expect} from "vitest";
import {resolveGranularityRange, detectRollingGranularity, formatRangeLabel} from "./granularity";

const today = new Date(2026, 7, 7); // Aug 7, 2026 (month is 0-indexed)

describe("resolveGranularityRange", () => {
  it("1W resolves to one week back through today", () => {
    expect(resolveGranularityRange("1W", today)).toEqual({ customStart: "2026-07-31", customEnd: "2026-08-07" });
  });

  it("1M resolves to one month back through today", () => {
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

  it("handles a rolling-month subtraction that would naively overflow (Mar 31 - 6 months)", () => {
    const mar31 = new Date(2026, 2, 31);
    // date-fns subMonths clamps to the last valid day of the target month (Sep 2025 has 30 days),
    // rather than naive Date arithmetic overflowing into October.
    expect(resolveGranularityRange("6M", mar31).customStart).toBe("2025-09-30");
  });
});

describe("detectRollingGranularity", () => {
  it("detects 1W", () => {
    expect(detectRollingGranularity("custom", "2026-07-31", "2026-08-07", today)).toBe("1W");
  });

  it("detects 1M", () => {
    expect(detectRollingGranularity("custom", "2026-07-07", "2026-08-07", today)).toBe("1M");
  });

  it("detects a rolling range that exactly matches 3M's computed range", () => {
    expect(detectRollingGranularity("custom", "2026-05-07", "2026-08-07", today)).toBe("3M");
  });

  it("detects YTD", () => {
    expect(detectRollingGranularity("custom", "2026-01-01", "2026-08-07", today)).toBe("YTD");
  });

  it("returns null for month mode (no custom range to match against)", () => {
    expect(detectRollingGranularity("month", "", "", today)).toBeNull();
  });

  it("returns null for the 'all' mode", () => {
    expect(detectRollingGranularity("all", "", "", today)).toBeNull();
  });

  it("returns null for a custom range that doesn't match any granularity", () => {
    expect(detectRollingGranularity("custom", "2026-03-15", "2026-04-20", today)).toBeNull();
  });
});

describe("formatRangeLabel", () => {
  it("omits the year on the start date when both ends fall in the same year", () => {
    expect(formatRangeLabel("2026-07-31", "2026-08-07")).toBe("31 Jul – 07 Aug 2026");
  });

  it("includes the year on both ends when they cross a year boundary", () => {
    expect(formatRangeLabel("2025-12-25", "2026-01-01")).toBe("25 Dec 2025 – 01 Jan 2026");
  });

  it("returns an empty string when either date is missing", () => {
    expect(formatRangeLabel("", "2026-08-07")).toBe("");
    expect(formatRangeLabel("2026-08-07", "")).toBe("");
    expect(formatRangeLabel("", "")).toBe("");
  });
});
