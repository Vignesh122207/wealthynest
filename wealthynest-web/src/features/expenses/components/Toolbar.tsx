import {Download, Search, SlidersHorizontal, X} from "lucide-react";

// Add Expense/Income/Transfer already live on the FAB (visible on every screen size, not just
// mobile) — a second "Add Transaction" dropdown here duplicated it. Statement import now lives
// per-account on the Accounts page, so the one action left here is exporting the current view.
export function Toolbar({
  search, setSearch, onOpenFilters, activeFilterCount, onExport,
}: {
  search: string; setSearch: (v: string) => void;
  onOpenFilters: () => void; activeFilterCount: number;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-nowrap">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <input placeholder="Search transactions, merchants, accounts…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-9 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/50 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all" />
        {search && (
          <button onClick={() => setSearch("")} aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <button onClick={onOpenFilters} aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
        className="flex items-center gap-1.5 sm:gap-2 h-10 px-3 sm:px-4 rounded-xl text-sm font-medium bg-muted border border-border text-muted-foreground hover:text-foreground transition-all shrink-0">
        <SlidersHorizontal className="w-4 h-4" /> <span className="hidden sm:inline">Filters</span>
        {activeFilterCount > 0 && (
          <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
        )}
      </button>
      <button onClick={onExport} aria-label="Download"
        className="flex items-center gap-1.5 sm:gap-2 h-10 px-3 sm:px-4 rounded-xl text-sm font-medium bg-muted border border-border text-muted-foreground hover:text-foreground transition-all shrink-0">
        <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download</span>
      </button>
    </div>
  );
}
