import {describe, expect, it, vi} from "vitest";
import {toLocalISODate, todayLocalISO} from "./date";

describe("toLocalISODate", () => {
  it("formats a local date as YYYY-MM-DD without any UTC conversion", () => {
    expect(toLocalISODate(new Date(2026, 6, 31, 1, 30))).toBe("2026-07-31");
  });

  it("pads single-digit month and day", () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("does not roll back a day for a time shortly after local midnight", () => {
    // This is exactly the case toISOString().split("T")[0] gets wrong in a timezone ahead of
    // UTC (e.g. IST): local midnight-ish should still read as the same local calendar day.
    expect(toLocalISODate(new Date(2026, 7, 1, 0, 30))).toBe("2026-08-01");
  });
});

describe("todayLocalISO", () => {
  it("reads from the local calendar, not toISOString()'s UTC-converted date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 31, 1, 30));
    expect(todayLocalISO()).toBe("2026-07-31");
    vi.useRealTimers();
  });
});
