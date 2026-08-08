import {useLayoutEffect, useRef, useState} from "react";
import {cn} from "@/lib/utils";
import {DropdownPanel} from "@/components/transactions/DropdownPanel";
import {DualCalendarRangePicker} from "./DualCalendarRangePicker";
import {detectRollingGranularity, formatRangeLabel, resolveGranularityRange, rollingGranularityLabel, type RollingGranularity} from "../utils/granularity";
import type {DateMode} from "../types/filters.types";

// A single Mac-style rounded-full segmented capsule — 1W/1M/3M/6M/YTD plus Custom — replacing the
// old "This Month/This Year/All/Custom" calendar-anchored cluster entirely. "This Month" is now
// the always-visible MonthScrubber sitting next to this capsule (see MonthScrubber.tsx); "This
// Year" is reachable by hand-picking Jan 1 – Dec 31 in Custom's calendar; "All time" is Custom left
// empty — page.tsx already resolves dateMode="custom" with no start/end to an unbounded query, the
// exact same startDate/endDate the old dedicated "all" mode produced, so no separate pill is needed
// for it.
const ROLLING_PILLS: RollingGranularity[] = ["1W", "1M", "3M", "6M", "YTD"];
type CapsuleKey = RollingGranularity | "custom";

export function DateRangeCapsule({ dateMode, setDateMode, customStart, setCustomStart, customEnd, setCustomEnd, className }: {
  dateMode: DateMode; setDateMode: (m: DateMode) => void;
  customStart: string; setCustomStart: (s: string) => void;
  customEnd: string; setCustomEnd: (s: string) => void;
  className?: string;
}) {
  const now = new Date();
  const rolling = detectRollingGranularity(dateMode, customStart, customEnd, now);
  const isGenuineCustom = dateMode === "custom" && !rolling && !!(customStart || customEnd);
  const active: CapsuleKey | null = isGenuineCustom ? "custom" : rolling;

  const btnRefs = useRef<Partial<Record<CapsuleKey, HTMLButtonElement | null>>>({});
  const customTriggerRef = useRef<HTMLButtonElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const btn = active ? btnRefs.current[active] : undefined;
    setPill(btn ? { left: btn.offsetLeft, width: btn.offsetWidth } : null);
  }, [active]);

  const [customOpen, setCustomOpen] = useState(false);

  const selectRolling = (g: RollingGranularity) => {
    const range = resolveGranularityRange(g, now);
    setDateMode("custom"); setCustomStart(range.customStart); setCustomEnd(range.customEnd);
    setCustomOpen(false);
  };

  const customLabel = isGenuineCustom ? formatRangeLabel(customStart, customEnd) : "Custom";

  return (
    <div className={cn("relative flex items-center h-10 bg-muted p-0.5 rounded-xl shrink-0", className)}>
      {pill && (
        <div aria-hidden
          className="absolute top-0.5 h-9 rounded-lg bg-blue-500/15 shadow-sm transition-[transform,width] duration-200 ease-out"
          style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />
      )}
      {ROLLING_PILLS.map(g => {
        const range = resolveGranularityRange(g, now);
        return (
          <button key={g} type="button" ref={el => { btnRefs.current[g] = el; }} onClick={() => selectRolling(g)}
            data-testid={`date-mode-${g.toLowerCase()}`}
            title={`${rollingGranularityLabel(g)} (${formatRangeLabel(range.customStart, range.customEnd)})`}
            className={cn("relative z-[1] px-4 h-9 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
              active === g ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground")}>
            {g}
          </button>
        );
      })}
      <button type="button" ref={el => { btnRefs.current.custom = el; customTriggerRef.current = el; }}
        onClick={() => setCustomOpen(v => !v)} data-testid="date-mode-custom" title={customLabel}
        aria-haspopup="dialog" aria-expanded={customOpen}
        className={cn("relative z-[1] px-4 h-9 rounded-lg text-xs font-medium whitespace-nowrap truncate max-w-[150px] transition-colors",
          active === "custom" ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground")}>
        {customLabel}
      </button>

      <DropdownPanel anchorRef={customTriggerRef} open={customOpen} onClose={() => setCustomOpen(false)} minWidth={392}>
        <DualCalendarRangePicker
          customStart={isGenuineCustom ? customStart : ""}
          customEnd={isGenuineCustom ? customEnd : ""}
          onApply={(s, e) => { setDateMode("custom"); setCustomStart(s); setCustomEnd(e); setCustomOpen(false); }}
          onClear={() => { setDateMode("custom"); setCustomStart(""); setCustomEnd(""); setCustomOpen(false); }}
        />
      </DropdownPanel>
    </div>
  );
}
