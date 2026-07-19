"use client";

import {Eye, Star} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {resolveVaultIcon} from "@/lib/categoryMeta";
import {cn, formatDate} from "@/lib/utils";
import type {VaultItem} from "../types/vault.types";

// Row click opens Edit — same convention as AssetRow/BudgetRow/GoalCard across the rest of the
// app — with Reveal and Favorite as their own explicit icon buttons alongside it.
export function VaultItemRow({ item, accentColor, onReveal, onEdit, onToggleFavorite }: {
  item: VaultItem;
  /** Cycled per-item from a shared palette by the parent (same approach as GoalCard's
   * goalColor) — keeps each row visually distinct instead of every row sharing one hue. */
  accentColor: string;
  onReveal: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
}) {
  const icon = resolveVaultIcon(item);
  return (
    <div className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
      <button type="button" onClick={onEdit} aria-label={`Edit ${item.title}`} className="flex items-center gap-4 flex-1 min-w-0 text-left">
        <PremiumIcon icon={icon} hex={accentColor} size="sm" className="w-10 h-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {item.username && <span className="text-xs text-muted-foreground/80 truncate">{item.username}</span>}
            {item.category && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                style={{ backgroundColor: accentColor + "18", color: accentColor }}>
                {item.category}
              </span>
            )}
            {item.lastRevealedAt && (
              <span className="text-xs text-muted-foreground/60 shrink-0">· viewed {formatDate(item.lastRevealedAt)}</span>
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
