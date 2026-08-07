import {useLayoutEffect, useRef, useState} from "react";
import {ChevronLeft, ChevronRight} from "lucide-react";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {cn} from "@/lib/utils";
import {monthLabel} from "../utils/filterHelpers";
import {detectRollingGranularity, formatRangeLabel, resolveGranularityRange, type RollingGranularity} from "../utils/granularity";
import type {DateMode} from "../types/filters.types";

// Two separate segmented groups, not one merged row: "This Month/This Year/All/Custom" (calendar-
// anchored + edge cases) and "1W/1M/3M/6M/YTD" (rolling windows ending today) are different kinds
// of choice, so they get their own visually distinct pill clusters — the rolling group uses a
// warm copper "premium" selected state instead of this page's usual indigo, so it reads as its
// own thing at a glance, not a continuation of the first group.
type CalendarMode = "month" | "year" | "all" | "custom";
const CALENDAR_PILLS: { mode: CalendarMode; label: string }[] = [
  { mode: "month",  label: "This Month" },
  { mode: "year",   label: "This Year" },
  { mode: "all",    label: "All" },
  { mode: "custom", label: "Custom" },
];
const ROLLING_PILLS: { mode: RollingGranularity; label: string }[] = [
  { mode: "1W", label: "1W" },
  { mode: "1M", label: "1M" },
  { mode: "3M", label: "3M" },
  { mode: "6M", label: "6M" },
  { mode: "YTD", label: "YTD" },
];

/** A segmented pill cluster with a sliding active indicator — used twice below (calendar modes in
 * the app's usual indigo, rolling ranges in copper) rather than duplicating the measure-and-slide
 * logic for each. `active` may be null when neither group's selection lives in this one — the
 * indicator just hides itself rather than pointing at nothing. */
function SegmentedGroup<T extends string>({ options, active, onSelect, theme, testIdPrefix }: {
  options: { mode: T; label: string }[];
  active: T | null;
  onSelect: (mode: T) => void;
  theme: "indigo" | "copper";
  testIdPrefix: string;
}) {
  const btnRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const btn = active ? btnRefs.current[active] : undefined;
    setPill(btn ? { left: btn.offsetLeft, width: btn.offsetWidth } : null);
  }, [active]);

  return (
    <div className="relative flex items-center h-10 bg-muted/40 border border-border/70 rounded-2xl p-1 shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {pill && (
        <div aria-hidden
          className={cn("absolute top-1 h-8 rounded-xl transition-[transform,width] duration-200 ease-out",
            theme === "copper"
              ? "bg-gradient-to-br from-[#4a2f1a] to-[#241509] ring-1 ring-[#c17f4e]/45 shadow-[0_2px_8px_rgba(193,127,78,0.25)]"
              : "bg-indigo-500/12 dark:bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/25")}
          style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />
      )}
      {options.map(({ mode, label }) => (
        <button key={mode} ref={el => { btnRefs.current[mode] = el; }} onClick={() => onSelect(mode)}
          data-testid={`${testIdPrefix}${mode.toLowerCase()}`}
          className={cn("relative z-[1] px-3 h-8 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors",
            active === mode
              ? theme === "copper" ? "text-[#f0c090]" : "text-indigo-600 dark:text-indigo-400"
              : "text-muted-foreground hover:text-foreground")}>
          {label}
        </button>
      ))}
    </div>
  );
}

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

  // Each group's own active pill — independent, since a selection in one group means nothing is
  // highlighted in the other (picking "3M" lights up nothing in the This Month/Year/All/Custom
  // cluster, and vice versa).
  const activeCalendar: CalendarMode | null =
    dateMode === "month" ? "month" :
    dateMode === "year"  ? "year"  :
    dateMode === "all"   ? "all"   :
    dateMode === "custom" && !rolling ? "custom" : null;
  const activeRolling: RollingGranularity | null = rolling;

  const selectCalendar = (mode: CalendarMode) => {
    if (mode === "custom" && rolling) {
      // Only reset when we're coming FROM a rolling preset (e.g. YTD) — its dates are still
      // sitting in customStart/customEnd, which still matches YTD's own computed range, so this
      // group's own active-pill detection kept resolving back to null/wrong here instead of
      // "custom". A genuine custom range the user already typed is left alone in every other case.
      setCustomStart(""); setCustomEnd("");
    }
    setDateMode(mode);
  };

  const selectRolling = (granularity: RollingGranularity) => {
    const range = resolveGranularityRange(granularity, now);
    setDateMode("custom"); setCustomStart(range.customStart); setCustomEnd(range.customEnd);
  };

  const rangeLabel = rolling ? formatRangeLabel(customStart, customEnd) : "";

  return (
    <div className="space-y-2.5">
      {/* flex-nowrap + overflow-x-auto: on a narrow viewport this strip scrolls horizontally
          (same pattern as a tab strip) rather than breaking the Month/Year navigator onto a
          second line. */}
      <div className="flex items-center gap-2.5 flex-nowrap overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        <SegmentedGroup options={CALENDAR_PILLS} active={activeCalendar} onSelect={selectCalendar}
          theme="indigo" testIdPrefix="date-mode-" />
        <SegmentedGroup options={ROLLING_PILLS} active={activeRolling} onSelect={selectRolling}
          theme="copper" testIdPrefix="date-mode-" />

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
          <div className="flex items-center h-10 px-3.5 rounded-2xl bg-gradient-to-br from-[#4a2f1a] to-[#241509] ring-1 ring-[#c17f4e]/45 shrink-0">
            <span className="text-xs font-semibold text-[#f0c090] tabular-nums whitespace-nowrap">{rangeLabel}</span>
          </div>
        )}
      </div>

      {activeCalendar === "custom" && (
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
