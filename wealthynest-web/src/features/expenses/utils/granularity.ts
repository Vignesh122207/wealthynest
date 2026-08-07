import {format, startOfYear, subMonths} from "date-fns";
import type {DateMode} from "../types/filters.types";

/** Rolling-window quick ranges offered inline in the unified date-range control, alongside the
 * calendar-anchored "This Month"/"This Year" and the "All"/"Custom" modes those pills don't cover.
 * Kept separate from DateMode — each of these is really dateMode="custom" with a specific computed
 * range, not a mode of its own. */
export type RollingGranularity = "3M" | "6M" | "YTD";
export const ROLLING_GRANULARITIES: RollingGranularity[] = ["3M", "6M", "YTD"];

const ISO_FORMAT = "yyyy-MM-dd";

/** The {customStart, customEnd} pair (paired with dateMode="custom") that selecting a rolling-
 * window granularity applies. Uses date-fns' subMonths/startOfYear (already a dependency, see
 * FormDatePicker) rather than naive Date month arithmetic, which mishandles a start-of-month edge
 * case (e.g. "1 month back from Mar 31" naively overflows into April). */
export function resolveGranularityRange(granularity: RollingGranularity, today: Date): { customStart: string; customEnd: string } {
  const customEnd = format(today, ISO_FORMAT);
  const startDate =
    granularity === "3M" ? subMonths(today, 3) :
    granularity === "6M" ? subMonths(today, 6) :
    startOfYear(today); // YTD
  return { customStart: format(startDate, ISO_FORMAT), customEnd };
}

/** Reverse-derives which rolling granularity (if any) the page's CURRENT custom date range
 * matches, so the unified control can highlight the right pill without a separate piece of state
 * that would need manually resetting every time the date changes some other way (This Month/This
 * Year navigation, or a genuine custom range picked in the popover). Returns null when the current
 * range doesn't exactly match any rolling preset — including when dateMode isn't "custom" at all. */
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
