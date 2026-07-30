import {
    ArrowUpDown,
    CreditCard,
    IndianRupee,
    type LucideIcon,
    RefreshCw,
    SlidersHorizontal,
    Tag,
    Wallet,
    X
} from "lucide-react";
import {type IconTone, PremiumIcon} from "@/components/icons/PremiumIcon";
import {getCategoryColor, getCategoryIcon} from "@/lib/categoryMeta";
import {ACCOUNT_TYPE_META} from "@/lib/accountTypeMeta";
import {cn} from "@/lib/utils";
import {SortPills} from "./SortPills";
import type {Channel, SortKey, TxType} from "../types/filters.types";
import type {Category} from "@/features/categories/types/category.types";

export function FilterPanel({
  open, onClose, txType,
  categories, categoryId, setCategoryId,
  payChannel, setPayChannel,
  minAmount, setMinAmount, maxAmount, setMaxAmount,
  recurringOnly, setRecurringOnly,
  currSymbol,
  sortKey, setSortKey,
  incomeSort, setIncomeSort,
  transferSort, setTransferSort,
  allAccounts, selectedAccountIds, setSelectedAccountIds,
  onClearAll, activeFilterCount,
}: {
  open: boolean; onClose: () => void; txType: TxType;
  categories: Category[]; categoryId: string; setCategoryId: (v: string) => void;
  payChannel: Channel; setPayChannel: (v: Channel) => void;
  minAmount: number | ""; setMinAmount: (v: number | "") => void;
  maxAmount: number | ""; setMaxAmount: (v: number | "") => void;
  recurringOnly: boolean; setRecurringOnly: (v: boolean | ((p: boolean) => boolean)) => void;
  currSymbol: string;
  sortKey: SortKey; setSortKey: (v: SortKey) => void;
  incomeSort: "newest"|"oldest"|"high"|"low"; setIncomeSort: (v: "newest"|"oldest"|"high"|"low") => void;
  transferSort: "newest"|"oldest"|"high"|"low"; setTransferSort: (v: "newest"|"oldest"|"high"|"low") => void;
  allAccounts: { id: string; name: string; accountType?: string }[]; selectedAccountIds: string[]; setSelectedAccountIds: (v: string[] | ((p: string[]) => string[])) => void;
  onClearAll: () => void; activeFilterCount: number;
}) {
  if (!open) return null;
  const showExpenseFilters = txType === "expenses" || txType === "all";

  const sectionLabel = (Icon: LucideIcon, label: string, tone: IconTone) => (
    <p className="flex items-center gap-2 text-xs font-semibold text-foreground/70 uppercase tracking-widest mb-2.5">
      <PremiumIcon icon={Icon} tone={tone} size="xs" /> {label}
    </p>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      {/* `fixed inset-y-0` — unlike ordinary flowed content — needs its own safe-area padding
          instead of inheriting any from an ancestor; without it, the "Filters" header row rendered
          directly under the status bar on native, overlapping the clock/battery/wifi icons. Same
          fix as Sidebar's mobile drawer and AppLockScreen. */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[380px] bg-background sm:border-l border-border shadow-2xl flex flex-col"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500 shrink-0" />
        <div className="flex items-center gap-3 px-5 h-16 border-b border-border shrink-0">
          <PremiumIcon icon={SlidersHorizontal} tone="indigo" size="sm" />
          <h3 className="font-semibold text-foreground">Filters</h3>
          {activeFilterCount > 0 && (
            <button onClick={onClearAll} className="text-xs text-indigo-500 hover:text-indigo-600 transition-colors">Clear all</button>
          )}
          <button onClick={onClose} aria-label="Close filters"
            className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Sort */}
          <div className="bg-card border border-border rounded-xl p-3">
            {sectionLabel(ArrowUpDown, "Sort by", "indigo")}
            {txType === "income" ? (
              <SortPills value={incomeSort} onChange={setIncomeSort} options={[
                { value: "newest", label: "Newest" }, { value: "oldest", label: "Oldest" },
                { value: "high",   label: "Highest" }, { value: "low",    label: "Lowest" },
              ]} />
            ) : txType === "transfers" ? (
              <SortPills value={transferSort} onChange={setTransferSort} options={[
                { value: "newest", label: "Newest" }, { value: "oldest", label: "Oldest" },
                { value: "high",   label: "Highest" }, { value: "low",    label: "Lowest" },
              ]} />
            ) : (
              <SortPills value={sortKey} onChange={setSortKey} options={[
                { value: "date-desc",   label: "Newest" },
                { value: "date-asc",    label: "Oldest" },
                { value: "amount-desc", label: "Highest" },
                { value: "amount-asc",  label: "Lowest" },
              ]} />
            )}
          </div>

          {showExpenseFilters && (
            <>
              <div className="bg-card border border-border rounded-xl p-3">
                {sectionLabel(Tag, "Category", "orange")}
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setCategoryId("")}
                    className={cn("flex items-center gap-1.5 pl-1.5 pr-3 h-8 rounded-lg text-xs font-medium border transition-all",
                      !categoryId ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400" : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                    <PremiumIcon icon={Tag} tone="gray" size="xs" />
                    All
                  </button>
                  {categories.map(c => {
                    const icon  = getCategoryIcon({ name: c.name, icon: c.icon });
                    const color = getCategoryColor(c.name, c.color);
                    return (
                      <button key={c.id} onClick={() => setCategoryId(c.id === categoryId ? "" : c.id)}
                        className={cn("flex items-center gap-1.5 pl-1.5 pr-3 h-8 rounded-lg text-xs font-medium border transition-all",
                          categoryId === c.id ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400" : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                        <PremiumIcon icon={icon} hex={color} size="xs" />
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-3">
                {sectionLabel(CreditCard, "Payment channel", "blue")}
                <div className="flex items-center h-9 bg-muted/60 border border-border rounded-xl p-0.5 w-fit">
                  {(["", "CASH", "ACCOUNT", "CREDIT"] as Channel[]).map(ch => {
                    const meta = ch === "CASH" ? ACCOUNT_TYPE_META.CASH_WALLET
                      : ch === "ACCOUNT" ? ACCOUNT_TYPE_META.BANK_ACCOUNT
                      : ch === "CREDIT"  ? ACCOUNT_TYPE_META.CREDIT_CARD
                      : undefined;
                    return (
                      <button key={ch} onClick={() => setPayChannel(ch)}
                        className={cn("flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap",
                          payChannel === ch ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                        {meta && <meta.icon className="w-3 h-3" style={{ color: meta.hex }} />}
                        {ch === "" ? "All" : ch === "CASH" ? "Cash" : ch === "ACCOUNT" ? "Bank" : "Card"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-3">
                {sectionLabel(IndianRupee, "Amount range", "green")}
                <div className="flex items-center gap-2">
                  <input type="text" inputMode="decimal" placeholder="Min" value={minAmount}
                    onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); setMinAmount(v === "" ? "" : Number(v)); }}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-indigo-500 transition-colors" />
                  <span className="text-muted-foreground/80 text-xs">to</span>
                  <input type="text" inputMode="decimal" placeholder="Max" value={maxAmount}
                    onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); setMaxAmount(v === "" ? "" : Number(v)); }}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <p className="text-[11px] text-muted-foreground/80 mt-1.5">In {currSymbol}</p>
              </div>

              <div className="bg-card border border-border rounded-xl p-3">
                <button onClick={() => setRecurringOnly(v => !v)}
                  className={cn("flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border transition-all",
                    recurringOnly
                      ? "bg-violet-500/15 border-violet-500/40 text-violet-600 dark:text-violet-400"
                      : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                  <RefreshCw className="w-3 h-3" style={{ color: "#5E5CE6" }} /> Recurring only
                </button>
              </div>
            </>
          )}

          {txType === "transfers" && allAccounts.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-3">
              {sectionLabel(Wallet, "Accounts", "cyan")}
              <div className="flex flex-wrap gap-1.5">
                {allAccounts.map(a => {
                  const meta = a.accountType ? ACCOUNT_TYPE_META[a.accountType as keyof typeof ACCOUNT_TYPE_META] : undefined;
                  return (
                    <button key={a.id}
                      onClick={() => setSelectedAccountIds(prev => prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id])}
                      className={cn("flex items-center gap-1.5 pl-1.5 pr-3 h-8 rounded-lg text-xs font-medium border transition-all",
                        selectedAccountIds.includes(a.id) ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400" : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                      {meta && <PremiumIcon icon={meta.icon} hex={meta.hex} size="xs" />}
                      {a.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border shrink-0">
          <button onClick={onClose} className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all">
            Apply
          </button>
        </div>
      </div>
    </>
  );
}
