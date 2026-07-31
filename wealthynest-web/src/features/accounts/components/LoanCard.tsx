import {memo} from "react";
import {Download, HandCoins} from "lucide-react";
import {formatDate} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import type {WalletAccount} from "../types/account.types";

export const LoanCard = memo(function LoanCard({ account: a, onDownload, onEdit, onRecordPayment }: {
  account: WalletAccount;
  onDownload:      () => void;
  onEdit:          () => void;
  onRecordPayment: () => void;
}) {
  const { fmt } = useAmountFormatter();

  const outstanding = Math.max(0, a.currentBalance);
  const principal   = a.principalAmount ?? a.openingBalance;
  const paidPct     = principal > 0 ? Math.min(100, Math.max(0, ((principal - outstanding) / principal) * 100)) : 0;
  const closed      = outstanding <= 0;
  return (
    <div onClick={onEdit}
      className="relative bg-card border border-border rounded-2xl p-5 space-y-4 cursor-pointer">
      {/* Real, separately-focusable control for the same action the card's plain onClick above
          already does — a role="button" here would nest the Download/Record Payment controls
          below inside another interactive widget (axe's nested-interactive rule), so the card
          itself stays a non-widget div and this sr-only-until-focused button is the
          keyboard/screen-reader path to Edit instead (see AccountCard.tsx's identical fix). */}
      <button type="button" onClick={onEdit}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-20 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-xs focus:font-medium">
        Edit {a.name}
      </button>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-rose-500/10">
            <HandCoins className="w-5 h-5 text-rose-500 dark:text-rose-400" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
              {closed && (
                <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Paid off</span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mt-0.5">Outstanding</p>
          </div>
        </div>
        <button title="Download statement" onClick={e => { e.stopPropagation(); onDownload(); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-indigo-500/70 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all shrink-0">
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-2xl font-bold text-foreground tabular-nums">{fmt(outstanding)}</p>

      <div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-1 tabular-nums">
          {paidPct.toFixed(0)}% of {fmt(principal)} repaid
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {a.emiAmount != null && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            EMI {fmt(a.emiAmount)}{a.emiDay ? ` · ${a.emiDay}${a.emiDay === 1 ? "st" : a.emiDay === 2 ? "nd" : a.emiDay === 3 ? "rd" : "th"}` : ""}
          </span>
        )}
        {a.autopayAccountName && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            Auto-pay ← {a.autopayAccountName}
          </span>
        )}
        {a.apr != null && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{a.apr}% p.a.</span>
        )}
        {a.nextEmiDate && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            Next EMI {formatDate(a.nextEmiDate)}
          </span>
        )}
      </div>

      {!closed && (
        <button onClick={e => { e.stopPropagation(); onRecordPayment(); }}
          className="w-full h-9 rounded-xl text-xs font-medium bg-gradient-to-br from-rose-600 to-rose-500 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 hover:-translate-y-0.5 text-white transition-all">
          Record Payment
        </button>
      )}
    </div>
  );
});
