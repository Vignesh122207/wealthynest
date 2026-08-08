"use client";

import {useEffect, useRef, useState} from "react";
import {cn} from "@/lib/utils";
import {DropdownPanel} from "@/components/transactions/DropdownPanel";
import {DualCalendarRangePicker} from "./DualCalendarRangePicker";
import {
  detectRollingGranularity, formatRangeLabel, resolveGranularityRange,
  ROLLING_GRANULARITIES, type RollingGranularity,
} from "../utils/granularity";
import type {DateMode} from "../types/filters.types";

// Mobile-only period picker — a persistent, thumb-reachable strip stacked directly above the
// shared FloatingActionButton (9.5rem: FAB's own bottom-[5.5rem] + its 3.5rem (h-14) height, plus
// a hair of breathing room). Never overlaps or repositions the FAB itself — that component is
// shared app-wide and stays untouched (see FloatingActionButton.tsx). Desktop keeps
// DateRangeCapsule + MonthScrubber inline in the Toolbar instead; this is the alternative for a
// screen too narrow to fit both there, modeled on a wallet app's bottom period scrubber.
export function MobileDateStrip({
  dateMode, setDateMode, year, setYear, month, setMonth, customStart, setCustomStart, customEnd, setCustomEnd,
}: {
  dateMode: DateMode; setDateMode: (m: DateMode) => void;
  year: number; setYear: (y: number) => void;
  month: number; setMonth: (m: number) => void;
  customStart: string; setCustomStart: (s: string) => void;
  customEnd: string; setCustomEnd: (s: string) => void;
}) {
  const now = new Date();
  const rolling = detectRollingGranularity(dateMode, customStart, customEnd, now);
  const isGenuineCustom = dateMode === "custom" && !rolling && !!(customStart || customEnd);
  // "This Month"/"This Year" are shortcuts to TODAY's month/year specifically — dateMode "month"
  // on its own also covers any month reached by paging MonthScrubber elsewhere, so the pill only
  // lights up when it actually matches what tapping it would produce.
  const isThisMonth = dateMode === "month" && year === now.getFullYear() && month === now.getMonth() + 1;
  const isThisYear  = dateMode === "year"  && year === now.getFullYear();

  const railRef = useRef<HTMLDivElement>(null);
  const customTriggerRef = useRef<HTMLButtonElement>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [fade, setFade] = useState({ left: false, right: false });

  // Same scroll-fade-mask technique as TabBar (see that component for the full rationale) — the
  // one thing DateRangeCapsule's fixed 6-pill row never needed, since this row has to fit 8 pills
  // plus two dividers in the same mobile-width space.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    function updateFade() {
      if (!rail) return;
      setFade({ left: rail.scrollLeft > 4, right: rail.scrollWidth - rail.clientWidth - rail.scrollLeft > 4 });
    }
    updateFade();
    rail.addEventListener("scroll", updateFade);
    window.addEventListener("resize", updateFade);
    return () => { rail.removeEventListener("scroll", updateFade); window.removeEventListener("resize", updateFade); };
  }, []);

  const selectRolling = (g: RollingGranularity) => {
    const range = resolveGranularityRange(g, now);
    setDateMode("custom"); setCustomStart(range.customStart); setCustomEnd(range.customEnd);
  };
  const selectThisMonth = () => { setDateMode("month"); setYear(now.getFullYear()); setMonth(now.getMonth() + 1); };
  const selectThisYear  = () => { setDateMode("year");  setYear(now.getFullYear()); };

  const customLabel = isGenuineCustom ? formatRangeLabel(customStart, customEnd) : "Custom";
  const maskImage = `linear-gradient(to right, ${fade.left ? "transparent" : "black"} 0, black 24px, black calc(100% - 24px), ${fade.right ? "transparent" : "black"} 100%)`;

  const pillClass = (active: boolean) => cn(
    "shrink-0 snap-start h-8 px-3.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
    active
      ? "text-white border-transparent bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-md shadow-indigo-500/40"
      : "text-muted-foreground bg-card border-border hover:text-foreground"
  );

  return (
    <div
      className="fixed left-0 right-0 z-30 lg:hidden bg-[hsl(var(--sidebar-bg))]/95 backdrop-blur-xl border-t border-border"
      style={{ bottom: "calc(9.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">Period</p>
      <div
        ref={railRef}
        className="flex items-center gap-1.5 overflow-x-auto snap-x snap-proximity no-scrollbar px-4 pb-2.5"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        {ROLLING_GRANULARITIES.map(g => (
          <button key={g} type="button" onClick={() => selectRolling(g)} data-testid={`mobile-date-mode-${g.toLowerCase()}`}
            className={pillClass(rolling === g)}>
            {g}
          </button>
        ))}
        <span className="shrink-0 w-px h-4 bg-border mx-0.5" aria-hidden />
        <button type="button" onClick={selectThisMonth} data-testid="mobile-date-mode-this-month" className={pillClass(isThisMonth)}>
          This Month
        </button>
        <button type="button" onClick={selectThisYear} data-testid="mobile-date-mode-this-year" className={pillClass(isThisYear)}>
          This Year
        </button>
        <span className="shrink-0 w-px h-4 bg-border mx-0.5" aria-hidden />
        <button type="button" ref={customTriggerRef} onClick={() => setCustomOpen(v => !v)} data-testid="mobile-date-mode-custom"
          aria-haspopup="dialog" aria-expanded={customOpen} className={cn(pillClass(isGenuineCustom), "max-w-[140px] truncate")}>
          {customLabel}
        </button>
      </div>

      <DropdownPanel anchorRef={customTriggerRef} open={customOpen} onClose={() => setCustomOpen(false)} minWidth={340}>
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
