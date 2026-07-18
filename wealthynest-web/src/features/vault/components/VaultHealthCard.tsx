"use client";

import {useState} from "react";
import {ChevronDown, Copy, ShieldAlert, ShieldCheck, ShieldX} from "lucide-react";
import {Card} from "@/components/ui/Card";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {resolveVaultIcon} from "@/lib/categoryMeta";
import {cn} from "@/lib/utils";
import {useVaultHealth} from "../hooks/useVault";
import type {VaultHealthItemSummary, VaultItem} from "../types/vault.types";

const VAULT_COPPER = "#c2703d";

const TILES = [
  { key: "reused" as const,   label: "Reused",   icon: Copy,        tone: "orange" as const },
  { key: "weak" as const,     label: "Weak",      icon: ShieldAlert, tone: "yellow" as const },
  { key: "breached" as const, label: "Breached",  icon: ShieldX,     tone: "red" as const },
];

export function VaultHealthCard({ items, onEditItem }: { items: VaultItem[]; onEditItem: (item: VaultItem) => void }) {
  const { data: health, isLoading } = useVaultHealth();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return <Card className="p-4"><div className="h-16 bg-muted/40 rounded-xl animate-pulse" /></Card>;
  }
  if (!health) return null;

  const counts: Record<string, number> = { reused: health.reusedCount, weak: health.weakCount, breached: health.breachedCount };
  const lists: Record<string, VaultHealthItemSummary[]> = { reused: health.reusedItems, weak: health.weakItems, breached: health.breachedItems };

  if (health.reusedCount === 0 && health.weakCount === 0 && health.breachedCount === 0) {
    return (
      <Card className="p-4 flex items-center gap-3" data-testid="vault-health-all-clear">
        <PremiumIcon icon={ShieldCheck} hex={VAULT_COPPER} size="xs" />
        <div>
          <p className="text-sm font-semibold text-foreground">Vault Health: All clear</p>
          <p className="text-xs text-muted-foreground">No reused, weak, or breached passwords found.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" data-testid="vault-health-card">
      <div className="px-5 py-3 border-b border-border">
        <span className="font-semibold text-foreground text-sm">Vault Health</span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/40">
        {TILES.map(({ key, label, icon, tone }) => {
          const count = counts[key];
          const isOpen = expanded === key;
          return (
            <button key={key} type="button" disabled={count === 0} data-testid={`vault-health-tile-${key}`}
              onClick={() => setExpanded(isOpen ? null : key)}
              className="p-4 text-left disabled:cursor-default hover:bg-muted/20 transition-colors disabled:hover:bg-transparent">
              <PremiumIcon icon={icon} tone={count > 0 ? tone : "gray"} size="xs" className="mb-2" />
              <div className="flex items-center gap-1">
                <p className="text-lg font-bold text-foreground tabular-nums">{count}</p>
                {count > 0 && <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground/60 transition-transform", isOpen && "rotate-180")} />}
              </div>
              <p className="text-xs text-muted-foreground">{label}</p>
            </button>
          );
        })}
      </div>
      {expanded && (
        <div className="divide-y divide-border/40 border-t border-border">
          {lists[expanded].map((summary) => {
            const item = items.find((i) => i.id === summary.id);
            return (
              <button key={summary.id} type="button" disabled={!item} data-testid="vault-health-item-row"
                onClick={() => item && onEditItem(item)}
                className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-muted/20 transition-colors text-left">
                <PremiumIcon icon={resolveVaultIcon(summary)} hex={VAULT_COPPER} size="xs" />
                <span className="text-sm text-foreground truncate">{summary.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
