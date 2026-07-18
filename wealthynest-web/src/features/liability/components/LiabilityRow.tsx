"use client";

import {AlertTriangle} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {getLiabilityTypeMeta, typeLabel} from "@/lib/netWorthTypeMeta";
import {LIABILITY_TYPES} from "@/lib/constants";
import {cn, formatDate} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import type {Liability} from "../types/liability.types";

function paidPct(outstanding: number, principal: number) {
  if (!principal || principal <= 0) return 0;
  return Math.min(100, ((principal - outstanding) / principal) * 100);
}

export function LiabilityRow({ liability, onEdit }: {
  liability: Liability;
  onEdit:    () => void;
}) {
  const { fmt } = useAmountFormatter();
  const meta  = getLiabilityTypeMeta(liability.liabilityType);
  const pct   = paidPct(liability.outstandingAmount, liability.principalAmount);
  // Compare date strings directly to avoid timezone-midnight false-positives
  const todayStr  = new Date().toISOString().split("T")[0];
  const isOverdue = !!(liability.endDate && liability.endDate < todayStr);

  const content = (
    <div className="flex items-start gap-4">
      <PremiumIcon icon={meta.icon} hex={meta.hex} size="sm" className="w-10 h-10 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground truncate">{liability.name}</p>
              {liability.derived && (
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-[10px] font-semibold shrink-0">
                  from Accounts
                </span>
              )}
              {isOverdue && !liability.derived && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-semibold shrink-0">
                  <AlertTriangle className="w-3 h-3" /> Overdue
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: meta.hex + "18", color: meta.hex }}>
                {typeLabel(LIABILITY_TYPES, liability.liabilityType)}
              </span>
              {liability.lenderName && <span className="text-xs text-muted-foreground/60">· {liability.lenderName}</span>}
              {liability.interestRate != null && <span className="text-xs text-muted-foreground/60">· {liability.interestRate}% p.a.</span>}
              {liability.endDate && <span className="text-xs text-muted-foreground/60">· Payoff {formatDate(liability.endDate)}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">{fmt(liability.outstandingAmount)}</p>
            <p className="text-xs text-muted-foreground/60">outstanding</p>
          </div>
        </div>
        {/* Repayment progress */}
        {liability.principalAmount > 0 && (
          <div className="mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground/60">Repaid</span>
              <span className="text-xs text-muted-foreground/80 tabular-nums">
                {fmt(liability.principalAmount - liability.outstandingAmount)} / {fmt(liability.principalAmount)}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground/60">{pct.toFixed(0)}% paid off</span>
              {liability.emiAmount && (
                <span className="text-xs text-muted-foreground/80">EMI {fmt(liability.emiAmount)}/mo</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Auto-linked (derived) liabilities are read-only — nothing to edit, so the row stays a plain div.
  if (liability.derived) {
    return (
      <div className={cn("px-5 py-4", isOverdue && "border-l-2 border-amber-500/60 bg-amber-500/4")}>
        {content}
      </div>
    );
  }

  return (
    <button type="button" onClick={onEdit} aria-label={`Edit ${liability.name} liability`}
      className={cn("w-full text-left px-5 py-4 hover:bg-muted/20 transition-colors", isOverdue && "border-l-2 border-amber-500/60 bg-amber-500/4")}>
      {content}
    </button>
  );
}
