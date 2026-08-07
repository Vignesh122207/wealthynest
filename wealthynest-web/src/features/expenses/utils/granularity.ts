import {format, startOfYear, subMonths, subWeeks} from "date-fns";
import type {DateMode} from "../types/filters.types";

/** Rolling-window quick ranges offered inline in the unified date-range control, alongside the
 * calendar-anchored "This Month"/"This Year" and the "All"/"Custom" modes those pills don't cover.
 * Kept separate from DateMode — each of these is really dateMode="custom" with a specific computed
 * range, not a mode of its own. */
export type RollingGranularity = "1W" | "1M" | "3M" | "6M" | "YTD";
export const ROLLING_GRANULARITIES: RollingGranularity[] = ["1W", "1M", "3M", "6M", "YTD"];

const ISO_FORMAT = "yyyy-MM-dd";

/** The {customStart, customEnd} pair (paired with dateMode="custom") that selecting a rolling-
 * window granularity applies. Uses date-fns' subWeeks/subMonths/startOfYear (already a dependency,
 * see FormDatePicker) rather than naive Date arithmetic, which mishandles a start-of-month edge
 * case (e.g. "1 month back from Mar 31" naively overflows into April). */
export function resolveGranularityRange(granularity: RollingGranularity, today: Date): { customStart: string; customEnd: string } {
  const customEnd = format(today, ISO_FORMAT);
  const startDate =
    granularity === "1W" ? subWeeks(today, 1) :
    granularity === "1M" ? subMonths(today, 1) :
    granularity === "3M" ? subMonths(today, 3) :
    granularity === "6M" ? subMonths(today, 6) :
    startOfYear(today); // YTD
  return { customStart: format(startDate, ISO_FORMAT), customEnd };
}

/** Reverse-derives which rolling granularity (if any) the page's CURRENT custom date range
 * matches, so the unified control can highlight the right pill without a separate piece of state
 * that would need manually resetting every time the date changes some other way (This Month/This
 * Year navigation, or a genuine custom range picked via the Custom pill). Returns null when the
 * current range doesn't exactly match any rolling preset — including when dateMode isn't
 * "custom" at all. */
export function detectRollingGranularity(
  dateMode: DateMode,
  customStart: string,
  customEnd: string,
  today: Date,
): RollingGranularity | null {
  if (dateMode !== "custom") return null;
  for (const g of ROLLING_GRANULARITIES) {
    const range = resolveGranularityRange(g, today);
    if (range.customStart === customStart && range.customEnd === customEnd) return g;
  }
  return null;
}

const ROLLING_LABELS: Record<RollingGranularity, string> = {
  "1W":  "Last 7 days",
  "1M":  "Last 1 month",
  "3M":  "Last 3 months",
  "6M":  "Last 6 months",
  "YTD": "Year to date",
};

/** "Last 7 days", "Year to date", etc. — the human-readable name for a rolling preset, shown
 * wherever the applied date filter is described in prose (an active-filter chip, a tooltip). The
 * capsule's own pill still shows the short "1W"/"YTD" code — this is for everywhere else. */
export function rollingGranularityLabel(granularity: RollingGranularity): string {
  return ROLLING_LABELS[granularity];
}

/** "31 Jul – 07 Aug 2026" (or "1 Jan – 07 Aug" within the same year) — the read-only label shown
 * next to a rolling-window pill so 1W/1M/3M/6M/YTD show what they actually resolved to, without
 * opening the editable Custom range fields (those stay reserved for a genuine custom pick). */
export function formatRangeLabel(customStart: string, customEnd: string): string {
  if (!customStart || !customEnd) return "";
  const start = new Date(`${customStart}T00:00:00`);
  const end = new Date(`${customEnd}T00:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = format(start, sameYear ? "dd MMM" : "dd MMM yyyy");
  const endLabel = format(end, "dd MMM yyyy");
  return `${startLabel} – ${endLabel}`;
}
