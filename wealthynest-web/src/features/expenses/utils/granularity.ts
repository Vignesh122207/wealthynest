import {format, startOfYear, subMonths} from "date-fns";
import type {DateMode} from "../types/filters.types";

export type Granularity = "1M" | "3M" | "6M" | "YTD" | "ALL";
export const GRANULARITIES: Granularity[] = ["1M", "3M", "6M", "YTD", "ALL"];

const ISO_FORMAT = "yyyy-MM-dd";

/** The {customStart, customEnd} pair (paired with dateMode="custom") that selecting a rolling-
 * window granularity applies. "ALL" isn't handled here — it maps to the existing dateMode="all"
 * directly, not a custom range. Uses date-fns' subMonths/startOfYear (already a dependency, see
 * FormDatePicker) rather than naive Date month arithmetic, which mishandles a start-of-month
 * edge case (e.g. "1 month back from Mar 31" naively overflows into April). */
export function resolveGranularityRange(granularity: Exclude<Granularity, "ALL">, today: Date): { customStart: string; customEnd: string } {
  const customEnd = format(today, ISO_FORMAT);
  const startDate =
    granularity === "1M" ? subMonths(today, 1) :
    granularity === "3M" ? subMonths(today, 3) :
    granularity === "6M" ? subMonths(today, 6) :
    startOfYear(today); // YTD
  return { customStart: format(startDate, ISO_FORMAT), customEnd };
}

/** Reverse-derives which granularity segment (if any) the page's CURRENT date state matches, so
 * the segmented control can highlight the active one without a separate piece of state that would
 * need manually resetting every time the date changes some other way (the Month/Year picker, or a
 * custom range the user typed by hand). Returns null when the current state doesn't exactly match
 * any granularity's computed range. */
export function detectActiveGranularity(
  dateMode: DateMode,
  customStart: string,
  customEnd: string,
  today: Date,
): Granularity | null {
  if (dateMode === "all") return "ALL";
  if (dateMode !== "custom") return null;
  for (const g of ["1M", "3M", "6M", "YTD"] as const) {
    const range = resolveGranularityRange(g, today);
    if (range.customStart === customStart && range.customEnd === customEnd) return g;
  }
  return null;
}
