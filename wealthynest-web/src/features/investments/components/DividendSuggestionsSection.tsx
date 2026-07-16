"use client";

import { useState } from "react";
import { Banknote, X } from "lucide-react";
import {
  useDividendSuggestions, useLogIncome, useDismissDividend,
} from "@/features/investments/hooks/useInvestments";
import { formatDate, formatCurrencyExact, getCurrencySymbol } from "@/lib/utils";

export function DividendSuggestionsSection({ stockCount }: { stockCount: number }) {
  const { data: suggestions = [], isLoading } = useDividendSuggestions();
  const { mutate: logIncome, isPending: logging } = useLogIncome();
  const { mutate: dismissDividend, isPending: dismissing } = useDismissDividend();
  const pending = suggestions.filter(s => !s.alreadyLogged);

  // Editable amounts — keyed by `${investmentId}|${exDate}`
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const getAmt = (s: (typeof pending)[0]) => {
    const key = `${s.investmentId}|${s.exDate}`;
    return key in amounts ? amounts[key] : String(s.suggestedIncome);
  };

  if (isLoading || stockCount === 0) return null;

  if (suggestions.length === 0) {
    return (
      <div className="flex items-start gap-3 p-3.5 bg-muted/40 border border-border/60 rounded-2xl">
        <Banknote className="w-4 h-4 text-muted-foreground/80 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-muted-foreground">Dividend data updates at 8 PM on trading days</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            To add dividend income now, go to <strong className="text-muted-foreground/80">Accounts → Add Money</strong> and select <em>Dividend</em> as the source.
          </p>
        </div>
      </div>
    );
  }

  const handleLog = (s: (typeof pending)[0]) => {
    const amt = parseFloat(getAmt(s));
    if (isNaN(amt) || amt <= 0) return;
    logIncome({
      investmentId: s.investmentId,
      data: {
        incomeType: "DIVIDEND",
        exDate: s.exDate,
        amount: amt,
        perShare: s.dividendPerShare,
        shares: s.sharesHeld,
      },
    });
  };

  const handleLogAll = () => {
    pending.forEach(s => handleLog(s));
  };

  return (
    <div className="space-y-2">
      {pending.length > 0 && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Dividend Income to Log</h3>
              <span className="text-xs bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">{pending.length}</span>
            </div>
            {pending.length > 1 && (
              <button
                disabled={logging || dismissing}
                onClick={handleLogAll}
                className="h-7 px-3 rounded-lg text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white transition-all disabled:opacity-50 whitespace-nowrap">
                Log All
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {pending.map(s => {
              const key = `${s.investmentId}|${s.exDate}`;
              return (
                <div key={key}
                  className="bg-card rounded-xl px-3 py-3 space-y-2 border border-border/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{s.symbol}</p>
                      <p className="text-xs text-muted-foreground/80">
                        Ex-date {formatDate(s.exDate)} · {formatCurrencyExact(Number(s.dividendPerShare))}/share · {Number(s.sharesHeld).toFixed(0)} shares
                      </p>
                    </div>
                    <button
                      disabled={dismissing || logging}
                      onClick={() => dismissDividend({ investmentId: s.investmentId, exDate: s.exDate })}
                      className="text-xs text-muted-foreground/60 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                      title="Dismiss this suggestion">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/80">{getCurrencySymbol()}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getAmt(s)}
                        onChange={e => setAmounts(a => ({ ...a, [key]: e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") }))}
                        className="w-full h-8 pl-6 pr-2 rounded-lg bg-muted/60 border border-border text-xs text-foreground tabular-nums focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                      />
                    </div>
                    <button
                      disabled={logging || dismissing}
                      onClick={() => handleLog(s)}
                      className="h-8 px-3 rounded-lg text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white transition-all disabled:opacity-50 whitespace-nowrap">
                      Log
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground/60">
            Edit the amount if needed, then click <strong className="text-muted-foreground/80">Log</strong> to record each dividend.
            Click <X className="w-3 h-3 inline" /> to dismiss a suggestion permanently.
          </p>
        </div>
      )}
    </div>
  );
}
