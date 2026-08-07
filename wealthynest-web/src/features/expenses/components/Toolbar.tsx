import {Download, Search, SlidersHorizontal, X} from "lucide-react";
import {cn} from "@/lib/utils";
import {DateRangeCapsule} from "./DateRangeCapsule";
import {MonthScrubber} from "./MonthScrubber";
import type {DateMode} from "../types/filters.types";

// Three modules inside one parent row: search, the date range capsule + month scrubber grouped in
// one shared div (they're one logical "when" control together), and the filters/download actions.
// No wrapping "card" background on the row itself — the pills sit directly on the page, each
// carrying its own shape/fill, matching the reference. Colors go through this app's semantic
// tokens (bg-background/border-border/text-muted-foreground, etc.) rather than literal
// slate/white values so the row stays correct in dark mode.
const ACTION_BASE = "flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-medium transition-colors shrink-0";

export function Toolbar({
  search, setSearch, onOpenFilters, activeFilterCount, onExport,
  dateMode, setDateMode, year, setYear, month, setMonth,
  customStart, setCustomStart, customEnd, setCustomEnd,
}: {
  search: string; setSearch: (v: string) => void;
  onOpenFilters: () => void; activeFilterCount: number;
  onExport: () => void;
  dateMode: DateMode; setDateMode: (m: DateMode) => void;
  year: number; setYear: (y: number) => void;
  month: number; setMonth: (m: number) => void;
  customStart: string; setCustomStart: (s: string) => void;
  customEnd: string; setCustomEnd: (s: string) => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2">

      {/* DIV 1 — search, stretches to fill the row up to where the date group starts */}
      <div className="relative flex flex-1 min-w-[200px] items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground/50" />
        <input placeholder="Search description, category, amount…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-10 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/50 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all" />
        {search && (
          <button onClick={() => setSearch("")} aria-label="Clear search"
            className="absolute right-3.5 text-muted-foreground/60 hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* DIV 2 — date range capsule + month scrubber, grouped in one shared div */}
      <div className="flex items-center gap-3 flex-wrap">
        <DateRangeCapsule
          dateMode={dateMode} setDateMode={setDateMode}
          customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd}
        />
        <MonthScrubber dateMode={dateMode} setDateMode={setDateMode} year={year} setYear={setYear} month={month} setMonth={setMonth} />
      </div>

      {/* DIV 3 — utility actions, flush right */}
      <div className="flex items-center gap-2 ml-auto sm:ml-0">
        <button onClick={onOpenFilters} aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
          className={cn(ACTION_BASE, "bg-muted border border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground")}>
          <SlidersHorizontal className="w-4 h-4 text-indigo-500" /> Filters
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
          )}
        </button>
        <button onClick={onExport} aria-label="Download" title="Export"
          className={cn(ACTION_BASE, "bg-muted border border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground")}>
          <Download className="w-4 h-4 text-primary" /> Download
        </button>
      </div>
    </div>
  );
}
