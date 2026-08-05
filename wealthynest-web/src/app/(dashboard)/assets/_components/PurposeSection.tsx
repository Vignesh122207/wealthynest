import {ChevronDown, ChevronUp, Landmark, TrendingUp, Wallet} from "lucide-react";
import {useState} from "react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import type {PurposeBreakdown} from "@/features/networth/types/networth.types";

// ─── Purpose section — same accounts/investments already counted in the sections above,
// re-sliced by what the money is earmarked for (Emergency Fund, Retirement, ...). Purely a
// display breakdown, never added into totalAssets a second time. ───────────────────────────

function PurposeCard({ purpose, fmt }: { purpose: PurposeBreakdown; fmt: (n: number) => string }) {
  const [expanded, setExpanded] = useState(false);
  const showToggle = purpose.items.length > 1;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button type="button" onClick={() => showToggle && setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/20 transition-colors">
        <PremiumIcon icon={Wallet} tone="orange" size="sm" className="w-10 h-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{purpose.label}</p>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            {purpose.items.length} {purpose.items.length === 1 ? "source" : "sources"}
          </p>
        </div>
        <p className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400 shrink-0">
          {fmt(purpose.totalValue)}
        </p>
        {showToggle && (expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />)}
      </button>
      {(expanded || !showToggle) && (
        <div className="divide-y divide-border/40 border-t border-border/60">
          {purpose.items.map((item, i) => (
            <div key={`${item.sourceType}-${item.name}-${i}`} className="flex items-center gap-3 px-5 py-2.5">
              <PremiumIcon icon={item.sourceType === "INVESTMENT" ? TrendingUp : Landmark}
                tone={item.sourceType === "INVESTMENT" ? "indigo" : "emerald"} size="xs" className="shrink-0" />
              <p className="text-xs text-foreground flex-1 truncate">{item.name}</p>
              <p className="text-xs font-semibold tabular-nums text-muted-foreground">{fmt(item.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PurposeSection({ purposeBreakdown, fmt }: {
  purposeBreakdown: PurposeBreakdown[] | undefined;
  fmt: (n: number) => string;
}) {
  if (!purposeBreakdown || purposeBreakdown.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <PremiumIcon icon={Wallet} tone="orange" size="xs" />
        <h2 className="text-sm font-semibold text-foreground">By Purpose</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {purposeBreakdown.map(p => (
          <PurposeCard key={`${p.purpose}-${p.label}`} purpose={p} fmt={fmt} />
        ))}
      </div>
    </section>
  );
}
