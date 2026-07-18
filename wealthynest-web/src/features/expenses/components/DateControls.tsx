import {ChevronLeft, ChevronRight} from "lucide-react";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {cn} from "@/lib/utils";
import {monthLabel} from "../utils/filterHelpers";
import type {DateMode} from "../types/filters.types";

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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center h-9 bg-muted/60 border border-border rounded-xl p-0.5">
          {(["month", "year", "all", "custom"] as DateMode[]).map(m => (
            <button key={m} onClick={() => setDateMode(m)} data-testid={`date-mode-${m}`}
              className={cn("px-2.5 h-7 rounded-lg text-[11px] font-medium transition-all",
                dateMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {m === "month" ? "Month" : m === "year" ? "Year" : m === "custom" ? "Custom" : "All"}
            </button>
          ))}
        </div>
        {dateMode === "month" && (
          <>
            <button onClick={() => navigateMonth(-1)} aria-label="Previous month"
              className="w-7 h-7 rounded-lg bg-muted/60 border border-border hover:bg-muted flex items-center justify-center transition-all">
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[130px] text-center">{monthLabel(year, month)}</span>
            <button onClick={() => navigateMonth(1)} disabled={isCurrentMonth} aria-label="Next month"
              className="w-7 h-7 rounded-lg bg-muted/60 border border-border hover:bg-muted flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </>
        )}
        {dateMode === "year" && (
          <>
            <button onClick={() => setYear(year - 1)} aria-label="Previous year"
              className="w-7 h-7 rounded-lg bg-muted/60 border border-border hover:bg-muted flex items-center justify-center transition-all">
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[48px] text-center">{year}</span>
            <button onClick={() => setYear(year + 1)} disabled={year >= now.getFullYear()} aria-label="Next year"
              className="w-7 h-7 rounded-lg bg-muted/60 border border-border hover:bg-muted flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </>
        )}
      </div>
      {dateMode === "custom" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-44">
            <FormDatePicker label="From" value={customStart} onChange={setCustomStart} placeholder="Start date" />
          </div>
          <div className="w-44">
            <FormDatePicker label="To" value={customEnd} onChange={setCustomEnd} placeholder="End date" />
          </div>
          {customStart && customEnd && customEnd < customStart && (
            <p className="text-xs text-red-500 w-full">&quot;To&quot; date must be on or after &quot;From&quot; date.</p>
          )}
        </div>
      )}
    </div>
  );
}
