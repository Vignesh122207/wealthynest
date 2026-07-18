"use client";

import {Check, HandCoins} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {useMySplits, useSettleWithCounterpart} from "../hooks/useExpenseSplits";
import {cn} from "@/lib/utils";

/** Net IOU balances from split expenses — shown on the Family page. Fetches its own data so the
 * parent page doesn't need to know about the expense-split domain. */
export function SplitsCard() {
  const { fmt } = useAmountFormatter();
  const { data, isLoading } = useMySplits(true);
  const { mutate: settleWith, isPending: settling } = useSettleWithCounterpart();

  const balances = data?.balances ?? [];
  if (!isLoading && balances.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <PremiumIcon icon={HandCoins} tone="orange" size="xs" />
        <h3 className="text-sm font-semibold text-foreground">Split Expenses</h3>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2.5">
          {balances.map(b => {
            const theyOweMe = b.netAmount > 0;
            return (
              <div key={b.counterpartUserId} data-testid="split-balance-row" className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{b.counterpartName}</p>
                  <p className={cn("text-[11px]", theyOweMe ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {theyOweMe ? "owes you" : "you owe"} {fmt(Math.abs(b.netAmount))}
                  </p>
                </div>
                <button onClick={() => settleWith(b.counterpartUserId)} disabled={settling} data-testid="split-settle-button"
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all disabled:opacity-50 shrink-0">
                  <Check className="w-3 h-3" /> Settle up
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
