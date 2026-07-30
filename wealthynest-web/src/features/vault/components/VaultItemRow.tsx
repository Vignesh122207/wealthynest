"use client";

import {Copy, Eye, ShieldAlert, ShieldX, Star} from "lucide-react";
import {badgeTextColor, PremiumIcon} from "@/components/icons/PremiumIcon";
import {resolveVaultIcon} from "@/lib/categoryMeta";
import {cn, formatDate} from "@/lib/utils";
import {useIsDark} from "@/hooks/useIsDark";
import type {VaultItem} from "../types/vault.types";

const FLAG_META = {
  reused:   { icon: Copy,        label: "Reused",   color: "#e0740f" },
  weak:     { icon: ShieldAlert, label: "Weak",      color: "#c98a00" },
  breached: { icon: ShieldX,     label: "Breached",  color: "#e5484d" },
} as const;

// Row click opens Edit — same convention as AssetRow/BudgetRow/GoalCard across the rest of the
// app — with Reveal and Favorite as their own explicit icon buttons alongside it.
export function VaultItemRow({ item, accentColor, healthFlag, onReveal, onEdit, onToggleFavorite }: {
  item: VaultItem;
  /** Cycled per-item from a shared palette by the parent (same approach as GoalCard's
   * goalColor) for items without a recognized category — see getVaultCategoryColor. */
  accentColor: string;
  /** Worst Vault Health issue affecting this item, if any — mirrors VaultHealthCard's own
   * reused/weak/breached lists so the row itself carries the same signal without needing the
   * health card expanded. */
  healthFlag?: "reused" | "weak" | "breached" | null;
  onReveal: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
}) {
  const isDark = useIsDark();
  const icon = resolveVaultIcon(item);
  const flag = healthFlag ? FLAG_META[healthFlag] : null;
  return (
    <div className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
      <button type="button" onClick={onEdit} aria-label={`Edit ${item.title}`} className="flex items-center gap-4 flex-1 min-w-0 text-left">
        <PremiumIcon icon={icon} hex={accentColor} size="sm" className="w-10 h-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
            {item.title}
            {item.hasTotp && (
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded shrink-0"
                style={{ backgroundColor: accentColor + "18", color: badgeTextColor(accentColor, isDark) }}>
                2FA
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {item.username && <span className="text-xs text-muted-foreground/80 truncate">{item.username}</span>}
            {item.category && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                style={{ backgroundColor: accentColor + "18", color: badgeTextColor(accentColor, isDark) }}>
                {item.category}
              </span>
            )}
            {flag && (
              <span className="text-xs font-semibold flex items-center gap-1 shrink-0" style={{ color: badgeTextColor(flag.color, isDark) }}>
                <flag.icon className="w-3 h-3" /> {flag.label}
              </span>
            )}
            {item.lastRevealedAt && (
              <span className="text-xs text-muted-foreground/80 shrink-0">· viewed {formatDate(item.lastRevealedAt)}</span>
            )}
          </div>
        </div>
      </button>
      <button type="button" onClick={onReveal} aria-label={`View ${item.title}`}
        className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-all shrink-0">
        <Eye className="w-4 h-4" />
      </button>
      <button type="button" onClick={onToggleFavorite}
        aria-label={item.favorite ? `Remove ${item.title} from favorites` : `Add ${item.title} to favorites`}
        className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-500/10 transition-all shrink-0">
        <Star className={cn("w-4 h-4", item.favorite && "fill-amber-500 text-amber-500")} />
      </button>
    </div>
  );
}
