import {useLayoutEffect, useRef, useState} from "react";
import {ChevronLeft, ChevronRight} from "lucide-react";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {cn} from "@/lib/utils";
import {monthLabel} from "../utils/filterHelpers";
import type {DateMode} from "../types/filters.types";

const DATE_MODES: DateMode[] = ["month", "year", "all", "custom"];
const DATE_MODE_LABEL: Record<DateMode, string> = { month: "Month", year: "Year", all: "All", custom: "Custom" };

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

  // A real sliding pill (measured off the active button, animated with transform) rather than
  // an instant background-color swap — the segmented control this is modeled on (iOS's) always
  // slides its selection, it never just recolors in place.
  const btnRefs = useRef<Partial<Record<DateMode, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const btn = btnRefs.current[dateMode];
    if (btn) setPill({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [dateMode]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex items-center h-9 bg-muted/60 border border-border rounded-xl p-0.5">
          {pill && (
            <div aria-hidden className="absolute top-0.5 h-7 rounded-lg bg-card shadow-sm transition-[transform,width] duration-200 ease-out"
              style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />
          )}
          {DATE_MODES.map(m => (
            <button key={m} ref={el => { btnRefs.current[m] = el; }} onClick={() => setDateMode(m)} data-testid={`date-mode-${m}`}
              className={cn("relative z-[1] px-2.5 h-7 rounded-lg text-[11px] font-medium transition-colors",
                dateMode === m ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {DATE_MODE_LABEL[m]}
            </button>
          ))}
        </div>
        {dateMode === "month" && (
          // Grouped (not three loose flex children) so flex-wrap either keeps the whole
          // prev/label/next unit on one line or wraps it as a block to the next line — it used to
          // wrap *between* them on narrow phones, stranding the month label on its own row
          // disconnected from its arrows and making it read as an unrelated stray label.
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
      {dateMode === "custom" && (
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
