import {Plus} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {ACCOUNT_TYPE_META} from "@/lib/accountTypeMeta";
import type {AccountType} from "../types/account.types";

// Every section grid is 2 columns wide — an odd card count leaves the last row half-empty.
// Filling that slot with an "add another" card keeps the grid full instead of lopsided,
// and doubles as the fastest way to add a second account of the same type.
export function AddMoreCard({ label, type, onClick }: { label: string; type: AccountType; onClick: () => void }) {
  const meta = ACCOUNT_TYPE_META[type];
  return (
    <button type="button" onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 min-h-[168px] rounded-2xl border-2 border-dashed border-border text-muted-foreground/70 transition-all hover:bg-muted/30"
      onMouseEnter={e => { e.currentTarget.style.borderColor = meta.hex + "60"; e.currentTarget.style.color = meta.hex; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.color = ""; }}>
      <PremiumIcon icon={meta.icon} hex={meta.hex} size="sm" />
      <span className="text-xs font-semibold flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add {label}</span>
    </button>
  );
}
