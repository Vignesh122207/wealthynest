"use client";

import {type LucideIcon, Trash2, X} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {cn} from "@/lib/utils";

// Vault's own modal header — a full-bleed graphite/gold banner instead of the plain icon+title
// row every other feature's FormModalHeader uses. Deliberately a separate component rather than
// a FormModalHeader variant: FormModalHeader is shared by Budgets/Goals/Debts/Assets/Family and
// this banner treatment is specific to Vault's "vault door" identity (see VaultHealthCard) — three
// call sites here (VaultItemForm, RevealSecretModal, ExportVaultModal) justify its own component.
// Renders inside FormModalShell's `p-5` body with negative margins to bleed to the card's edges;
// the shell's `overflow-hidden` clips it back to the rounded corners.
export function VaultModalHeader({ icon, hex, title, subtitle, danger, onDelete, onClose }: {
  icon: LucideIcon;
  /** Category-derived color for the icon badge — see getVaultCategoryColor. */
  hex: string;
  title: string;
  /** Short uppercase eyebrow under the title, e.g. "Add to vault" / "Reveal password". */
  subtitle: string;
  /** Swaps the graphite/brass "vault door" gradient for a dark-red one — used by
   * VaultDeleteConfirm, where the "you're about to destroy something" framing outweighs staying
   * on-brand with the rest of Vault's chrome. */
  danger?: boolean;
  onDelete?: () => void;
  onClose: () => void;
}) {
  return (
    <div className={cn(
      "relative -mx-5 -mt-5 mb-4 px-4 py-4 flex items-center gap-3 overflow-hidden bg-gradient-to-br",
      danger ? "from-[#3a1414] via-[#26100f] to-[#170808]" : "from-[#262c3d] via-[#171b26] to-[#0c0e15]"
    )}>
      <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 bg-hairline-diagonal opacity-50 pointer-events-none" aria-hidden />
      <PremiumIcon icon={icon} hex={hex} size="md" className="relative w-11 h-11 shrink-0" />
      <div className="relative flex-1 min-w-0">
        <p className="text-white font-bold text-[15px] truncate leading-tight">{title}</p>
        <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: danger ? "#fca5a5" : "#f6d776" }}>{subtitle}</p>
      </div>
      {onDelete && (
        <button type="button" onClick={onDelete} aria-label="Delete"
          className="relative w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 text-white/70 hover:text-red-300 hover:bg-red-500/20 transition-all shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Close"
        className="relative w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
