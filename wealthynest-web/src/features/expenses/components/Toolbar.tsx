import { Search, SlidersHorizontal, Upload } from "lucide-react";

// Add Expense/Income/Transfer already live on the FAB (visible on every screen size, not just
// mobile) — a second "Add Transaction" dropdown here duplicated it. Import is the one action the
// FAB doesn't cover, so it gets its own plain button instead of being buried in that menu.
export function Toolbar({
  search, setSearch, onOpenFilters, activeFilterCount, onImportStatement, hasAccounts,
}: {
  search: string; setSearch: (v: string) => void;
  onOpenFilters: () => void; activeFilterCount: number;
  onImportStatement: () => void; hasAccounts: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-nowrap">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <input placeholder="Search transactions, merchants, accounts…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/50 outline-none focus:border-indigo-500 transition-all" />
      </div>
      <button onClick={onOpenFilters} aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
        className="flex items-center gap-1.5 sm:gap-2 h-10 px-3 sm:px-4 rounded-xl text-sm font-medium bg-muted border border-border text-muted-foreground hover:text-foreground transition-all shrink-0">
        <SlidersHorizontal className="w-4 h-4" /> <span className="hidden sm:inline">Filters</span>
        {activeFilterCount > 0 && (
          <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
        )}
      </button>
      <button onClick={onImportStatement} disabled={!hasAccounts}
        aria-label="Import statement" title={!hasAccounts ? "Add an account first" : undefined}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 h-10 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0">
        <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Import</span>
      </button>
    </div>
  );
}
