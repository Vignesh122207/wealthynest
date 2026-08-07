import {useEffect, useLayoutEffect, useRef, useState} from "react";
import {CalendarRange, ChevronLeft, ChevronRight} from "lucide-react";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {cn} from "@/lib/utils";
import {monthLabel} from "../utils/filterHelpers";
import {detectRollingGranularity, resolveGranularityRange, type RollingGranularity} from "../utils/granularity";
import type {DateMode} from "../types/filters.types";

// Unified date-range control — merges what used to be two separate segmented pickers (Month/
// Year/All/Custom, and a second row of 1M/3M/6M/YTD/ALL quick ranges) into one row. The old pair
// duplicated "All" outright and put "Month" right next to "1M" (near-identical concepts), and
// the Month/Year navigator wrapped onto its own line the moment both rows fought for width.
// "This Month"/"This Year" absorb the old Month/Year modes (still calendar-anchored, still
// navigable with prev/next — that nav now lives inline in this same row, never below it); 3M/6M/
// YTD are rolling windows ending today; Custom moves to an icon + popover since it's the
// least-used option and doesn't need two date fields sitting in the always-visible row.
type PillMode = "month" | "3m" | "6m" | "ytd" | "year" | "all";
const PILLS: { mode: PillMode; label: string }[] = [
  { mode: "month", label: "This Month" },
  { mode: "3m",    label: "3M" },
  { mode: "6m",    label: "6M" },
  { mode: "ytd",   label: "YTD" },
  { mode: "year",  label: "This Year" },
  { mode: "all",   label: "All" },
];
const ROLLING_TO_PILL: Record<RollingGranularity, PillMode> = { "3M": "3m", "6M": "6m", YTD: "ytd" };

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
  const activePill: PillMode | null =
    dateMode === "month" ? "month" :
    dateMode === "year"  ? "year"  :
    dateMode === "all"   ? "all"   :
    rolling ? ROLLING_TO_PILL[rolling] : null; // dateMode "custom" with a range that isn't a rolling preset — a genuine custom range, no pill lit

  const selectPill = (mode: PillMode) => {
    if (mode === "month" || mode === "year" || mode === "all") { setDateMode(mode); return; }
    const granularity: RollingGranularity = mode === "3m" ? "3M" : mode === "6m" ? "6M" : "YTD";
    const range = resolveGranularityRange(granularity, now);
    setDateMode("custom"); setCustomStart(range.customStart); setCustomEnd(range.customEnd);
  };

  // Sliding pill (measured off the active button, animated with transform) — the segmented
  // control this is modeled on (iOS's) always slides its selection, it never just recolors in place.
  const btnRefs = useRef<Partial<Record<PillMode, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!activePill) { setPill(null); return; }
    const btn = btnRefs.current[activePill];
    if (btn) setPill({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [activePill]);

  // Custom range popover
  const [showCustom, setShowCustom] = useState(false);
  const customBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCustom) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (customBtnRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      // FormDatePicker's own calendar dropdown portals straight to document.body — outside this
      // popover's DOM subtree — so without this, picking a day in the From/To calendar closed
      // this whole popover before the inner picker could even register the selection (the click
      // target is a descendant of neither ref above).
      if (target instanceof HTMLElement && target.closest('[role="dialog"]')) return;
      setShowCustom(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setShowCustom(false); };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showCustom]);

  const setCustomRangeStart = (v: string) => { setCustomStart(v); setDateMode("custom"); };
  const setCustomRangeEnd   = (v: string) => { setCustomEnd(v);   setDateMode("custom"); };

  return (
    <div className="flex items-center gap-2">
      {/* flex-nowrap + overflow-x-auto instead of flex-wrap: on a narrow viewport this strip
          scrolls horizontally (same pattern as a tab strip) rather than breaking the nav onto a
          second line. Scoped to just the pills+nav (not the whole row) — an overflow-x-auto
          ancestor also clips overflow-y, which was cutting off the Custom popover below entirely. */}
      <div className="flex items-center gap-2 flex-nowrap overflow-x-auto pb-0.5 min-w-0" style={{ scrollbarWidth: "none" }}>
        <div className="relative flex items-center h-9 bg-muted/60 border border-border rounded-xl p-0.5 shrink-0">
          {pill && (
            <div aria-hidden className="absolute top-0.5 h-7 rounded-lg bg-card shadow-sm transition-[transform,width] duration-200 ease-out"
              style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />
          )}
          {PILLS.map(({ mode, label }) => (
            <button key={mode} ref={el => { btnRefs.current[mode] = el; }} onClick={() => selectPill(mode)}
              data-testid={`date-pill-${mode}`}
              className={cn("relative z-[1] px-2.5 h-7 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors",
                activePill === mode ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>

        {dateMode === "month" && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => navigateMonth(-1)} aria-label="Previous month"
              className="w-7 h-7 rounded-lg bg-muted/60 border border-border hover:bg-muted flex items-center justify-center transition-all">
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[130px] text-center">{monthLabel(year, month)}</span>
            <button onClick={() => navigateMonth(1)} disabled={isCurrentMonth} aria-label="Next month"
              className="w-7 h-7 rounded-lg bg-muted/60 border border-border hover:bg-muted flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}
        {dateMode === "year" && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setYear(year - 1)} aria-label="Previous year"
              className="w-7 h-7 rounded-lg bg-muted/60 border border-border hover:bg-muted flex items-center justify-center transition-all">
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[48px] text-center">{year}</span>
            <button onClick={() => setYear(year + 1)} disabled={year >= now.getFullYear()} aria-label="Next year"
              className="w-7 h-7 rounded-lg bg-muted/60 border border-border hover:bg-muted flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      <div className="relative shrink-0">
        <button ref={customBtnRef} onClick={() => setShowCustom(v => !v)} aria-label="Custom date range" data-testid="date-pill-custom"
          className={cn("w-9 h-9 rounded-xl border flex items-center justify-center transition-all",
            activePill === null ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400" : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
          <CalendarRange className="w-4 h-4" />
        </button>
        {showCustom && (
          <div ref={popoverRef}
            className="absolute right-0 top-full mt-2 z-20 w-72 bg-card border border-border rounded-2xl shadow-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground">Custom range</p>
            <div className="flex items-center gap-3">
              <div className="w-1/2">
                <FormDatePicker label="From" testId="date-range-from" value={customStart} onChange={setCustomRangeStart} placeholder="Start date" />
              </div>
              <div className="w-1/2">
                <FormDatePicker label="To" testId="date-range-to" value={customEnd} onChange={setCustomRangeEnd} placeholder="End date" />
              </div>
            </div>
            {customStart && customEnd && customEnd < customStart && (
              <p className="text-xs text-red-500">&quot;To&quot; date must be on or after &quot;From&quot; date.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
