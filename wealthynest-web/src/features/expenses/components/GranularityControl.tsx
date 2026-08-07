"use client";

import {useLayoutEffect, useRef, useState} from "react";
import {cn} from "@/lib/utils";
import {GRANULARITIES, detectActiveGranularity, resolveGranularityRange, type Granularity} from "../utils/granularity";
import type {DateMode} from "../types/filters.types";

interface GranularityControlProps {
  dateMode: DateMode;
  customStart: string;
  customEnd: string;
  onSelect: (patch: { dateMode: DateMode; customStart?: string; customEnd?: string }) => void;
}

const LABEL: Record<Granularity, string> = { "1M": "1M", "3M": "3M", "6M": "6M", YTD: "YTD", ALL: "ALL" };

/** Quick rolling-window shortcuts (1M/3M/6M/YTD/ALL) alongside the existing Month/Year/Custom
 * DateControls — not a replacement for it, since "last 3 months" and "the calendar month of July"
 * are genuinely different things a user might want. Selecting a segment only ever changes the
 * page's existing dateMode/customStart/customEnd state, so every metric on the page recalculates
 * through its normal (already-memoized) render path — no separate animation wiring needed for the
 * data itself, just this control's own sliding-pill transition. */
export function GranularityControl({ dateMode, customStart, customEnd, onSelect }: GranularityControlProps) {
  const today = new Date();
  const active = detectActiveGranularity(dateMode, customStart, customEnd, today);

  const btnRefs = useRef<Partial<Record<Granularity, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!active) { setPill(null); return; }
    const btn = btnRefs.current[active];
    if (btn) setPill({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [active]);

  const handleSelect = (g: Granularity) => {
    if (g === "ALL") { onSelect({ dateMode: "all" }); return; }
    onSelect({ dateMode: "custom", ...resolveGranularityRange(g, today) });
  };

  return (
    <div className="relative flex items-center h-8 bg-muted/60 border border-border rounded-lg p-0.5"
      role="tablist" aria-label="Quick time range">
      {pill && (
        <div aria-hidden className="absolute top-0.5 h-6 rounded-md bg-card shadow-sm transition-[transform,width] duration-200 ease-out"
          style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />
      )}
      {GRANULARITIES.map(g => (
        <button key={g} type="button" role="tab" aria-selected={active === g}
          ref={el => { btnRefs.current[g] = el; }}
          onClick={() => handleSelect(g)} data-testid={`granularity-${g}`}
          className={cn("relative z-[1] px-2.5 h-6 rounded-md text-[11px] font-medium transition-colors",
            active === g ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
          {LABEL[g]}
        </button>
      ))}
    </div>
  );
}
