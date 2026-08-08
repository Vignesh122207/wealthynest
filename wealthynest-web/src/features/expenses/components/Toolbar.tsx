import {useRef, useState} from "react";
import {Download, Layers, Search, SlidersHorizontal, X} from "lucide-react";
import {cn} from "@/lib/utils";
import {lighten} from "@/components/icons/PremiumIcon";
import {DropdownPanel} from "@/components/transactions/DropdownPanel";
import {DateRangeCapsule} from "./DateRangeCapsule";
import {MonthScrubber} from "./MonthScrubber";
import {TX_TYPE_COLOR, TX_TYPE_LABEL, TX_TYPE_OPTIONS} from "../utils/txTypeMeta";
import type {DateMode, TxType} from "../types/filters.types";

// Gradient-fill, lift-on-hover treatment — matches the app's own existing "Add an Account" CTA
// (expenses/page.tsx's addAccountCta) rather than inventing a new button language.
const GRADIENT_BASE = "flex items-center gap-2 shrink-0 text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all";
const ICON_CHIP = "w-5 h-5 rounded-md bg-white/20 flex items-center justify-center shrink-0";

// Desktop-only — the replacement for the old TypeTabs tab bar, now that it's gone entirely.
// A single dropdown instead of a row of tabs since it sits inline in the toolbar next to Filters/
// Download rather than above it; the trigger's own fill tracks whichever type is selected (same
// per-type color TypeTabs used to carry) so it still reads as "this IS the current type," not just
// a generic filter.
function TypeButton({ txType, onTxTypeChange, counts }: {
  txType: TxType; onTxTypeChange: (v: TxType) => void; counts: Record<TxType, number>;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const color = TX_TYPE_COLOR[txType];

  return (
    <div className="relative shrink-0">
      <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox" aria-expanded={open} data-testid="toolbar-type-button"
        className={cn(GRADIENT_BASE, "h-9 pl-1.5 pr-3 rounded-lg text-xs")}
        style={{ background: `linear-gradient(135deg, ${lighten(color, 0.3)}, ${color})`, boxShadow: `0 6px 16px -8px ${color}99` }}>
        <span className={ICON_CHIP}><Layers className="w-3 h-3" /></span>
        {TX_TYPE_LABEL[txType]}
      </button>
      <DropdownPanel anchorRef={triggerRef} open={open} onClose={() => setOpen(false)} minWidth={180}>
        <div className="p-1.5">
          {TX_TYPE_OPTIONS.map(value => {
            const active = txType === value;
            return (
              <button key={value} type="button" data-testid={`toolbar-type-option-${value}`}
                onClick={() => { onTxTypeChange(value); setOpen(false); }}
                className={cn("flex items-center gap-2 w-full px-2.5 h-8 rounded-lg text-xs font-medium transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TX_TYPE_COLOR[value] }} />
                {TX_TYPE_LABEL[value]}
                <span className="ml-auto tabular-nums text-[11px] text-muted-foreground/70">{counts[value]}</span>
              </button>
            );
          })}
        </div>
      </DropdownPanel>
    </div>
  );
}

export function Toolbar({
  search, setSearch, onOpenFilters, activeFilterCount, onExport,
  dateMode, setDateMode, year, setYear, month, setMonth,
  customStart, setCustomStart, customEnd, setCustomEnd,
  txType, onTxTypeChange, txTypeCounts,
}: {
  search: string; setSearch: (v: string) => void;
  onOpenFilters: () => void; activeFilterCount: number;
  onExport: () => void;
  dateMode: DateMode; setDateMode: (m: DateMode) => void;
  year: number; setYear: (y: number) => void;
  month: number; setMonth: (m: number) => void;
  customStart: string; setCustomStart: (s: string) => void;
  customEnd: string; setCustomEnd: (s: string) => void;
  /** Desktop only — TypeButton's props. Mobile switches type via FilterPanel's own Type section
   * instead (see FilterPanel.tsx), since there's no room for this button there too. */
  txType: TxType; onTxTypeChange: (v: TxType) => void; txTypeCounts: Record<TxType, number>;
}) {
  const searchInput = (id: string, placeholder: string) => (
    <div className="relative flex flex-1 min-w-0 items-center">
      <span className="absolute left-1.5 w-6 h-6 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
        <Search className="w-3.5 h-3.5" />
      </span>
      <input id={id} placeholder={placeholder} value={search} onChange={e => setSearch(e.target.value)}
        className="w-full h-9 pl-9 pr-8 rounded-lg text-sm bg-background border border-border text-foreground placeholder-muted-foreground/50 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all" />
      {search && (
        <button onClick={() => setSearch("")} aria-label="Clear search"
          className="absolute right-2.5 text-muted-foreground/60 hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop — one frosted-glass control cluster: search, date range, type, filters, download
          all read as a single premium unit instead of independently-styled controls. */}
      <div className="hidden lg:flex w-full items-center gap-2.5 p-1.5 rounded-xl bg-gradient-to-br from-indigo-500/[0.06] to-card border border-border">
        {searchInput("toolbar-search-desktop", "Search description, category, amount…")}

        <div className="flex items-center gap-2.5 flex-wrap">
          <DateRangeCapsule
            dateMode={dateMode} setDateMode={setDateMode}
            customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd}
          />
          {/* Month navigation stays exactly where it's always been, next to the date capsule. */}
          <MonthScrubber dateMode={dateMode} setDateMode={setDateMode} year={year} setYear={setYear} month={month} setMonth={setMonth} />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <TypeButton txType={txType} onTxTypeChange={onTxTypeChange} counts={txTypeCounts} />
          <button onClick={onOpenFilters} aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
            className={cn(GRADIENT_BASE, "relative h-9 pl-1.5 pr-3 rounded-lg text-xs bg-gradient-to-br from-indigo-600 to-indigo-500 shadow-indigo-500/30 hover:shadow-indigo-500/40")}>
            <span className={ICON_CHIP}><SlidersHorizontal className="w-3 h-3" /></span>
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-white text-indigo-700 text-[9px] font-bold flex items-center justify-center shadow">{activeFilterCount}</span>
            )}
          </button>
          <button onClick={onExport} aria-label="Download" title="Export"
            className={cn(GRADIENT_BASE, "h-9 pl-1.5 pr-3 rounded-lg text-xs bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-emerald-500/30 hover:shadow-emerald-500/40")}>
            <span className={ICON_CHIP}><Download className="w-3 h-3" /></span>
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
