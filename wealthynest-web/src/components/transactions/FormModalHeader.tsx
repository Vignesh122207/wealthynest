"use client";

import {type LucideIcon, Trash2, X} from "lucide-react";
import {type IconSize, type IconTone, PremiumIcon} from "@/components/icons/PremiumIcon";

export function FormModalHeader({ icon, tone, hex, size = "md", title, onDelete, onClose }: {
  icon: LucideIcon;
  /** Named palette tone, or a raw hex for callers with per-item dynamic colors (e.g. account
   * types) that don't map onto one of the fixed IconTone values. Provide exactly one. */
  tone?: IconTone; hex?: string;
  /** Defaults to "md" (this component's long-standing look, used by Budgets/Goals/Debts/Assets/
   * Family/etc.) — pass "sm" for a callers that wants a smaller header icon without affecting
   * every other consumer. */
  size?: IconSize;
  title: string; onDelete?: () => void; onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <PremiumIcon icon={icon} tone={tone} hex={hex} size={size} className={size === "md" ? "w-10 h-10" : undefined} />
      <h3 className="font-semibold text-foreground text-base flex-1 truncate">{title}</h3>
      {onDelete && (
        <div className="relative group shrink-0">
          <button type="button" onClick={onDelete} aria-label="Delete"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
          <span className="pointer-events-none absolute top-full right-0 mt-1.5 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 translate-y-0.5 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 z-10">
            Delete
          </span>
        </div>
      )}
      <button type="button" onClick={onClose} aria-label="Close"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
