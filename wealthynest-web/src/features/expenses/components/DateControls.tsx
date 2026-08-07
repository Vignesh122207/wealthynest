import {useLayoutEffect, useRef, useState} from "react";
import {ChevronLeft, ChevronRight} from "lucide-react";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {cn} from "@/lib/utils";
import {monthLabel} from "../utils/filterHelpers";
import {detectRollingGranularity, formatRangeLabel, resolveGranularityRange, type RollingGranularity} from "../utils/granularity";
import type {DateMode} from "../types/filters.types";

// Unified date-range control — merges what used to be two separate segmented pickers (Month/
// Year/All/Custom, and a second row of quick rolling ranges) into one row. "This Month"/"This
// Year" absorb the old Month/Year modes (still calendar-anchored, still navigable with prev/
// next — that nav lives inline in this same row, scrolling horizontally on narrow screens
// instead of wrapping to a second line). 1W/1M/3M/6M/YTD are rolling windows ending today —
// selecting one shows a read-only "31 Jul – 07 Aug" label inline (same slot as the Month/Year
// nav), never the editable Custom fields, since a rolling pill's whole point is a single click
// with nothing further to fill in. Custom is a plain pill; selecting it reveals the From/To
// fields inline below the row (not a popover — that had two real bugs: the row's own
// overflow-x-auto clipped it, and FormDatePicker's calendar portals to document.body, outside
// the popover's DOM tree, so picking a day closed the whole popover before the pick registered).
type PillMode = "month" | "1w" | "1m" | "3m" | "6m" | "ytd" | "year" | "all" | "custom";
const PILLS: { mode: PillMode; label: string }[] = [
  { mode: "month",  label: "This Month" },
  { mode: "1w",     label: "1W" },
  { mode: "1m",     label: "1M" },
  { mode: "3m",     label: "3M" },
  { mode: "6m",     label: "6M" },
  { mode: "ytd",    label: "YTD" },
  { mode: "year",   label: "This Year" },
  { mode: "all",    label: "All" },
  { mode: "custom", label: "Custom" },
];
const ROLLING_TO_PILL: Record<RollingGranularity, PillMode> = { "1W": "1w", "1M": "1m", "3M": "3m", "6M": "6m", YTD: "ytd" };
const PILL_TO_ROLLING: Partial<Record<PillMode, RollingGranularity>> = { "1w": "1W", "1m": "1M", "3m": "3M", "6m": "6M", ytd: "YTD" };

export function DateControls({ dateMode, setDateMode, year, setYear, month, setMonth,
  customStart, setCustomStart, customEnd, setCustomEnd }: {
  dateMode: DateMode; setDateMode: (m: DateMode) => void;
  year: number; setYear: (y: number) => void;
  month: number; setMonth: (m: number) => void;
  customStart: string; setCustomStart: (s: string) => void;
  customEnd: string; setCustomEnd: (s: string) => void;
}) {
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const navigateMonth = (dir: -1 | 1) => {
    if (dir === 1 && isCurrentMonth) return;
    let m = month + dir, y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y);
  };

  const rolling = detectRollingGranularity(dateMode, customStart, customEnd, now);
  const activePill: PillMode =
    dateMode === "month" ? "month" :
    dateMode === "year"  ? "year"  :
    dateMode === "all"   ? "all"   :
    rolling ? ROLLING_TO_PILL[rolling] :
    "custom"; // dateMode "custom" with a range that isn't a rolling preset (or nothing picked yet)

  const selectPill = (mode: PillMode) => {
    const granularity = PILL_TO_ROLLING[mode];
    if (granularity) {
      const range = resolveGranularityRange(granularity, now);
      setDateMode("custom"); setCustomStart(range.customStart); setCustomEnd(range.customEnd);
      return;
    }
    if (mode === "custom" && rolling) {
      // Only reset when we're coming FROM a rolling preset (e.g. YTD) — its dates are still
      // sitting in customStart/customEnd, which still matches YTD's own computed range, so
      // activePill kept resolving back to "ytd" instead of "custom" (the pill visually never
      // seemed to switch, even though dateMode really had changed). A genuine custom range the
      // user already typed shouldn't be wiped just for re-opening this pill, so leave it alone
      // in every other case.
      setCustomStart(""); setCustomEnd("");
    }
    setDateMode(mode as DateMode); // "month" | "year" | "all" | "custom"
  };

  // Sliding pill (measured off the active button, animated with transform) — the segmented
  // control this is modeled on (iOS's) always slides its selection, it never just recolors in place.
  const btnRefs = useRef<Partial<Record<PillMode, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const btn = btnRefs.current[activePill];
    if (btn) setPill({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [activePill]);

  const rangeLabel = rolling ? formatRangeLabel(customStart, customEnd) : "";

  return (
    <div className="space-y-2.5">
      {/* flex-nowrap + overflow-x-auto: on a narrow viewport this strip scrolls horizontally
          (same pattern as a tab strip) rather than breaking the Month/Year navigator onto a
          second line. */}
      <div className="flex items-center gap-2.5 flex-nowrap overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        <div className="relative flex items-center h-10 bg-muted/40 border border-border/70 rounded-2xl p-1 shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {pill && (
            <div aria-hidden
              className="absolute top-1 h-8 rounded-xl bg-indigo-500/12 dark:bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/25 transition-[transform,width] duration-200 ease-out"
              style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />
          )}
          {PILLS.map(({ mode, label }) => (
            <button key={mode} ref={el => { btnRefs.current[mode] = el; }} onClick={() => selectPill(mode)}
              data-testid={`date-pill-${mode}`}
              className={cn("relative z-[1] px-3 h-8 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors",
                activePill === mode ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>

        {dateMode === "month" && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => navigateMonth(-1)} aria-label="Previous month"
              className="w-8 h-8 rounded-xl bg-muted/60 border border-border/70 hover:bg-muted flex items-center justify-center transition-all">
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="text-sm font-bold text-foreground min-w-[130px] text-center">{monthLabel(year, month)}</span>
            <button onClick={() => navigateMonth(1)} disabled={isCurrentMonth} aria-label="Next month"
              className="w-8 h-8 rounded-xl bg-muted/60 border border-border/70 hover:bg-muted flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}
        {dateMode === "year" && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setYear(year - 1)} aria-label="Previous year"
              className="w-8 h-8 rounded-xl bg-muted/60 border border-border/70 hover:bg-muted flex items-center justify-center transition-all">
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="text-sm font-bold text-foreground min-w-[48px] text-center">{year}</span>
            <button onClick={() => setYear(year + 1)} disabled={year >= now.getFullYear()} aria-label="Next year"
              className="w-8 h-8 rounded-xl bg-muted/60 border border-border/70 hover:bg-muted flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}
        {rangeLabel && (
          <div className="flex items-center h-10 px-3.5 rounded-2xl bg-muted/40 border border-border/70 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground tabular-nums whitespace-nowrap">{rangeLabel}</span>
          </div>
        )}
      </div>

      {activePill === "custom" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-44">
            <FormDatePicker label="From" testId="date-range-from" value={customStart} onChange={setCustomStart} placeholder="Start date" />
          </div>
          <div className="w-44">
            <FormDatePicker label="To" testId="date-range-to" value={customEnd} onChange={setCustomEnd} placeholder="End date" />
          </div>
          {customStart && customEnd && customEnd < customStart && (
            <p className="text-xs text-red-500 w-full">&quot;To&quot; date must be on or after &quot;From&quot; date.</p>
          )}
        </div>
      )}
    </div>
  );
}
