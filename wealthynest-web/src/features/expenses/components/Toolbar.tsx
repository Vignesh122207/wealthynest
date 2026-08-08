import {Download, Search, SlidersHorizontal, X} from "lucide-react";
import {cn} from "@/lib/utils";
import {DateRangeCapsule} from "./DateRangeCapsule";
import {MonthScrubber} from "./MonthScrubber";
import type {DateMode} from "../types/filters.types";

// Gradient-fill, lift-on-hover treatment — matches the app's own existing "Add an Account" CTA
// (expenses/page.tsx's addAccountCta) rather than inventing a new button language.
const GRADIENT_BASE = "flex items-center gap-2 shrink-0 text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all";
const ICON_CHIP = "w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0";

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
  const searchInput = (id: string, placeholder: string) => (
    <div className="relative flex flex-1 min-w-0 items-center">
      <span className="absolute left-1.5 w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
        <Search className="w-3.5 h-3.5" />
      </span>
      <input id={id} placeholder={placeholder} value={search} onChange={e => setSearch(e.target.value)}
        className="w-full h-11 pl-11 pr-9 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/50 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all" />
      {search && (
        <button onClick={() => setSearch("")} aria-label="Clear search"
          className="absolute right-3 text-muted-foreground/60 hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop — one frosted-glass control cluster: search, date range, filters, download all
          read as a single premium unit instead of four independently-styled controls. */}
      <div className="hidden lg:flex w-full items-center gap-3 p-2 rounded-2xl bg-gradient-to-br from-indigo-500/[0.06] to-card border border-border">
        {searchInput("toolbar-search-desktop", "Search description, category, amount…")}

        <div className="flex items-center gap-3 flex-wrap">
          <DateRangeCapsule
            dateMode={dateMode} setDateMode={setDateMode}
            customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd}
          />
          <MonthScrubber dateMode={dateMode} setDateMode={setDateMode} year={year} setYear={setYear} month={month} setMonth={setMonth} />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={onOpenFilters} aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
            className={cn(GRADIENT_BASE, "relative h-11 pl-2 pr-4 rounded-xl text-sm bg-gradient-to-br from-indigo-600 to-indigo-500 shadow-indigo-500/30 hover:shadow-indigo-500/40")}>
            <span className={ICON_CHIP}><SlidersHorizontal className="w-3.5 h-3.5" /></span>
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white text-indigo-700 text-[10px] font-bold flex items-center justify-center shadow">{activeFilterCount}</span>
            )}
          </button>
          <button onClick={onExport} aria-label="Download" title="Export"
            className={cn(GRADIENT_BASE, "h-11 pl-2 pr-4 rounded-xl text-sm bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-emerald-500/30 hover:shadow-emerald-500/40")}>
            <span className={ICON_CHIP}><Download className="w-3.5 h-3.5" /></span>
            Download
          </button>
        </div>
      </div>

      {/* Mobile — search plus icon-only Filters/Download; date range moves to MobileDateStrip
          (a persistent bottom bar) instead of living here. No labels: at this width they're the
          only two buttons on the row, so the icon alone (colored, gradient-filled) reads fine. */}
      <div className="flex lg:hidden w-full items-center gap-2">
        {searchInput("toolbar-search-mobile", "Search transactions…")}
        <button onClick={onOpenFilters} aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
          className={cn(GRADIENT_BASE, "relative w-11 h-11 rounded-xl justify-center bg-gradient-to-br from-indigo-600 to-indigo-500 shadow-indigo-500/30")}>
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-white text-indigo-700 text-[9px] font-bold flex items-center justify-center shadow">{activeFilterCount}</span>
          )}
        </button>
        <button onClick={onExport} aria-label="Download" title="Export"
          className={cn(GRADIENT_BASE, "w-11 h-11 rounded-xl justify-center bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-emerald-500/30")}>
          <Download className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
