"use client";

import {useState} from "react";
import {ChevronDown, Copy, ShieldAlert, ShieldCheck, ShieldX} from "lucide-react";
import {Card} from "@/components/ui/Card";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {resolveVaultIcon} from "@/lib/categoryMeta";
import {cn} from "@/lib/utils";
import {useVaultHealth} from "../hooks/useVault";
import type {VaultHealthItemSummary, VaultHealthSummary, VaultItem} from "../types/vault.types";

// Vault's own accent identity: brushed graphite + brass, echoing the auth screens' engraved-metal
// brand panel (AuthBrandPanel's bg-dot-grid + bg-hairline-diagonal) so the thing being locked
// visually rhymes with the lock screen that guards it.
const VAULT_BRASS = "#d4a72c";
const VAULT_BRASS_LIGHT = "#f6d776";
const VAULT_BRASS_DEEP = "#a9791a";

const TILES = [
  { key: "reused" as const,   label: "Reused",   icon: Copy,        tone: "orange" as const },
  { key: "weak" as const,     label: "Weak",      icon: ShieldAlert, tone: "yellow" as const },
  { key: "breached" as const, label: "Breached",  icon: ShieldX,     tone: "red" as const },
];

const DIAL_RADIUS = 46;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

/** A simple weighted heuristic (breached counts triple, weak double, reused once, normalized
 * against total items) — not a backend-computed score. Keeps a vault with more items from being
 * penalized harder than a smaller one for the same absolute number of issues. */
function computeHealthScore(health: VaultHealthSummary): number {
  const total = health.totalItems || 1;
  const weighted = health.breachedCount * 3 + health.weakCount * 2 + health.reusedCount;
  const maxWeighted = total * 3;
  return Math.max(0, Math.min(100, Math.round(100 - (weighted / maxWeighted) * 100)));
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 40) return "Fair";
  return "Needs attention";
}

export function VaultHealthCard({ items, onEditItem }: { items: VaultItem[]; onEditItem: (item: VaultItem) => void }) {
  const { data: health, isLoading } = useVaultHealth();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return <Card className="p-4"><div className="h-24 bg-muted/40 rounded-xl animate-pulse" /></Card>;
  }
  if (!health) return null;

  const counts: Record<string, number> = { reused: health.reusedCount, weak: health.weakCount, breached: health.breachedCount };
  const lists: Record<string, VaultHealthItemSummary[]> = { reused: health.reusedItems, weak: health.weakItems, breached: health.breachedItems };
  const hasIssues = health.reusedCount > 0 || health.weakCount > 0 || health.breachedCount > 0;
  const score = computeHealthScore(health);
  const dialOffset = DIAL_CIRCUMFERENCE * (1 - score / 100);

  return (
    <Card className="relative overflow-hidden border-transparent" data-testid={hasIssues ? "vault-health-card" : "vault-health-all-clear"}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#262c3d] via-[#171b26] to-[#0c0e15]" aria-hidden />
      <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 bg-hairline-diagonal opacity-50 pointer-events-none" aria-hidden />

      <div className="relative flex flex-col sm:flex-row items-center gap-5 p-5 sm:p-6">
        <div className="relative w-28 h-28 shrink-0">
          <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
            <defs>
              <linearGradient id="vaultBrassDial" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={VAULT_BRASS_LIGHT} />
                <stop offset="100%" stopColor={VAULT_BRASS_DEEP} />
              </linearGradient>
            </defs>
            <circle cx="56" cy="56" r={DIAL_RADIUS} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
            <circle cx="56" cy="56" r={DIAL_RADIUS} fill="none" stroke="url(#vaultBrassDial)" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={DIAL_CIRCUMFERENCE} strokeDashoffset={dialOffset}
              style={{ transition: "stroke-dashoffset 0.6s ease" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[28px] font-extrabold text-white leading-none tabular-nums">{score}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide mt-1" style={{ color: VAULT_BRASS_LIGHT }}>
              {scoreLabel(score)}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1.5 mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: VAULT_BRASS_LIGHT }} />
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: VAULT_BRASS_LIGHT }}>Vault Health</span>
          </div>
          <h3 className="text-white font-bold text-[15px] mb-1">
            {hasIssues ? `${health.reusedCount + health.weakCount + health.breachedCount} things worth a look` : "All clear"}
          </h3>
          <p className="text-white/55 text-xs mb-4 max-w-md">
            {hasIssues
              ? "Reused and weak passwords are the easiest way into an account. Fix these first."
              : "No reused, weak, or breached passwords found."}
          </p>

          <div className="flex gap-2 flex-wrap justify-center sm:justify-start">
            {TILES.map(({ key, label, icon, tone }) => {
              const count = counts[key];
              const isOpen = expanded === key;
              return (
                <button key={key} type="button" disabled={count === 0} data-testid={`vault-health-tile-${key}`}
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-left
                    disabled:opacity-40 disabled:cursor-default hover:bg-white/9 transition-colors disabled:hover:bg-white/5">
                  <PremiumIcon icon={icon} tone={count > 0 ? tone : "gray"} size="xs" />
                  <div className="flex items-center gap-1">
                    <p className="text-lg font-bold text-white tabular-nums leading-none">{count}</p>
                    {count > 0 && <ChevronDown className={cn("w-3.5 h-3.5 text-white/50 transition-transform", isOpen && "rotate-180")} />}
                  </div>
                  <p className="text-[10.5px] text-white/50 font-medium">{label}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="relative divide-y divide-white/10 border-t border-white/10">
          {lists[expanded].map((summary) => {
            const item = items.find((i) => i.id === summary.id);
            return (
              <button key={summary.id} type="button" disabled={!item} data-testid="vault-health-item-row"
                onClick={() => item && onEditItem(item)}
                className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 transition-colors text-left">
                <PremiumIcon icon={resolveVaultIcon(summary)} hex={VAULT_BRASS} size="xs" />
                <span className="text-sm text-white/90 truncate">{summary.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
