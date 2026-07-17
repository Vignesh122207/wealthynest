import { Plus, ChevronDown, ChevronUp, AlertTriangle, Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { LiabilityRow } from "@/features/liability/components/LiabilityRow";
import type { Liability } from "@/features/liability/types/liability.types";
import type { NetWorthSummary } from "@/features/networth/types/networth.types";

const PREVIEW_COUNT = 3;

// ─── Liabilities section ──────────────────────────────────────────────────────

export function LiabilitiesSection({
  summary, liabilities, loadingLiabs, liabsError, refetchLiabs,
  showAllLiabs, setShowAllLiabs, onAdd, onEdit, fmt,
}: {
  summary:      NetWorthSummary | undefined;
  liabilities:  Liability[];
  loadingLiabs: boolean;
  liabsError:   boolean;
  refetchLiabs: () => void;
  showAllLiabs: boolean;
  setShowAllLiabs: (updater: (v: boolean) => boolean) => void;
  onAdd:  () => void;
  onEdit: (l: Liability) => void;
  fmt: (n: number) => string;
}) {
  return (
    <section>
      {/* Add Liability lived here too, redundant with the FAB's own "Add Liability" action. */}
      <div className="flex items-center gap-2 mb-3">
        <PremiumIcon icon={AlertTriangle} tone="red" size="xs" />
        <h2 className="text-sm font-semibold text-foreground">Liabilities</h2>
        <span className="text-xs text-muted-foreground/80">{liabilities.length}</span>
        {summary && <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">{fmt(summary.totalLiabilities)}</span>}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loadingLiabs ? (
          <div className="p-5 space-y-3">
            {[1,2].map(i => <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />)}
          </div>
        ) : liabsError ? (
          <QueryErrorState onRetry={refetchLiabs} description="Couldn't load your liabilities. Check your connection and try again." />
        ) : liabilities.length === 0 ? (
          <EmptyState icon={Wallet} title="No liabilities tracked"
            description="Add loans, EMIs, or credit card debt to get a true net worth picture."
            action={
              <button onClick={onAdd}
                className="flex items-center gap-2 bg-red-600/80 hover:bg-red-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                <Plus className="w-4 h-4" /> Add Liability
              </button>
            } />
        ) : (
          <div className="divide-y divide-border/40">
            {(showAllLiabs ? liabilities : liabilities.slice(0, PREVIEW_COUNT)).map(l => (
              <LiabilityRow key={l.id} liability={l} onEdit={() => onEdit(l)} />
            ))}
          </div>
        )}
        {liabilities.length > PREVIEW_COUNT && (
          <button onClick={() => setShowAllLiabs(v => !v)}
            className="w-full py-3 text-xs text-muted-foreground/80 hover:text-foreground flex items-center justify-center gap-1.5 transition-colors border-t border-border/60">
            {showAllLiabs
              ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
              : <><ChevronDown className="w-3.5 h-3.5" /> {liabilities.length - PREVIEW_COUNT} more liabilities</>}
          </button>
        )}
      </div>
    </section>
  );
}
