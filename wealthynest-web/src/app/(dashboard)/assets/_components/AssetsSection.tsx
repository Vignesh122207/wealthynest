import Link from "next/link";
import {Building2, ChevronDown, ChevronUp, Plus, TrendingUp} from "lucide-react";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {badgeTextColor, PremiumIcon} from "@/components/icons/PremiumIcon";
import {AssetRow} from "@/features/assets/components/AssetRow";
import {useIsDark} from "@/hooks/useIsDark";
import type {Asset} from "@/features/assets/types/asset.types";
import type {NetWorthSummary} from "@/features/networth/types/networth.types";
import {INV_TYPE_META} from "./netWorthMeta";

const PREVIEW_COUNT = 3;

// ─── Assets section — auto-linked investment-type rows (read-only) + manual asset rows ───

export function AssetsSection({
  summary, invBreakdown, assets, loadingAssets, assetsError, refetchAssets,
  showAllAssets, setShowAllAssets, onAdd, onEdit, fmt,
}: {
  summary:       NetWorthSummary | undefined;
  invBreakdown:  { assetType: string; totalValue: number; count: number }[];
  assets:        Asset[];
  loadingAssets: boolean;
  assetsError:   boolean;
  refetchAssets: () => void;
  showAllAssets: boolean;
  setShowAllAssets: (updater: (v: boolean) => boolean) => void;
  onAdd:  () => void;
  onEdit: (a: Asset) => void;
  fmt: (n: number) => string;
}) {
  const isDark = useIsDark();
  return (
    <section>
      {/* Add Asset lived here too, redundant with the FAB's own "Add Asset" action. */}
      <div className="flex items-center gap-2 mb-3">
        <PremiumIcon icon={Building2} tone="emerald" size="xs" />
        <h2 className="text-sm font-semibold text-foreground">Assets</h2>
        {summary && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(summary.totalAssets)}</span>}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Fallback: summary has investmentValue but no breakdown */}
        {invBreakdown.length === 0 && (summary?.investmentValue ?? 0) > 0 && (
          <Link href="/investments"
            className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors border-b border-border/40">
            <PremiumIcon icon={TrendingUp} tone="indigo" size="sm" className="w-10 h-10 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Investment Portfolio</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5">View in Investments</p>
            </div>
            <p className="text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400 min-w-[7rem] text-right">
              {fmt(summary!.investmentValue)}
            </p>
          </Link>
        )}

        {/* Investment type rows — read-only, click → specific investments tab */}
        {invBreakdown.map(b => {
          const meta = INV_TYPE_META[b.assetType];
          if (!meta) return null;
          return (
            <Link key={b.assetType} href={`/investments?tab=${meta.tab}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors border-b border-border/40 group">
              <PremiumIcon icon={meta.icon} hex={meta.color} size="sm" className="w-10 h-10 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  {b.count > 0 ? `${b.count} holding${b.count !== 1 ? "s" : ""}` : "Auto-linked"}
                  {" · "}View in Investments
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums shrink-0 min-w-[7rem] text-right" style={{ color: badgeTextColor(meta.color, isDark) }}>
                {fmt(b.totalValue)}
              </p>
            </Link>
          );
        })}

        {/* Subtle divider between investment rows and manual assets */}
        {invBreakdown.length > 0 && assets.length > 0 && (
          <div className="mx-5 border-t border-dashed border-border/60" />
        )}

        {/* Manual asset rows — editable */}
        {loadingAssets ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-muted/40 rounded-xl animate-pulse" />)}
          </div>
        ) : assetsError ? (
          <QueryErrorState onRetry={refetchAssets} description="Couldn't load your assets. Check your connection and try again." />
        ) : assets.length === 0 && invBreakdown.length === 0 ? (
          <EmptyState icon={Building2} title="No assets yet"
            description="Track physical assets like property, vehicles, gold, EPF balance, or business equity."
            action={
              <button onClick={onAdd}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                <Plus className="w-4 h-4" /> Add First Asset
              </button>
            } />
        ) : (
          <>
            <div className="divide-y divide-border/40">
              {(showAllAssets ? assets : assets.slice(0, PREVIEW_COUNT)).map(a => (
                <AssetRow key={a.id} asset={a} onEdit={() => onEdit(a)} />
              ))}
            </div>
            {assets.length > PREVIEW_COUNT && (
              <button onClick={() => setShowAllAssets(v => !v)}
                className="w-full py-3 text-xs text-muted-foreground/80 hover:text-foreground flex items-center justify-center gap-1.5 transition-colors border-t border-border/60">
                {showAllAssets
                  ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                  : <><ChevronDown className="w-3.5 h-3.5" /> {assets.length - PREVIEW_COUNT} more assets</>}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
