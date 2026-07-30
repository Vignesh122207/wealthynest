"use client";

import {useState} from "react";
import {ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronUp, Flag, Trash2} from "lucide-react";
import {cn, formatDate} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {useDeleteStockTransaction, useStockTransactions} from "../hooks/useInvestments";
import {fmtNum} from "../utils/formatNum";

// Matches InvestmentServiceImpl.SEED_TXN_NOTE exactly — a backfilled "opening position" row
// (created automatically the first time Buy More/Sell ran on a holding added before this ledger
// existed) reuses the plain `notes` field as its marker rather than a dedicated column, so it
// reads "Opening position" here instead of a plain "Buy" the user never actually clicked.
const SEED_TXN_NOTE = "Opening position (auto-recorded)";

export function StockTransactionHistoryPanel({ investmentId }: { investmentId: string }) {
  const { fmt, fmtExact } = useAmountFormatter();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { data: txns = [], isLoading } = useStockTransactions(investmentId, open);
  const { mutate: deleteTxn, isPending: deleting } = useDeleteStockTransaction();

  return (
    <div className="mt-2 pt-2 border-t border-border/60">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full text-xs text-muted-foreground/80 hover:text-foreground transition-colors">
        <span className="flex items-center gap-1.5">
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Transactions {txns.length > 0 ? `(${txns.length})` : ""}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-1">
          {isLoading ? (
            <p className="text-xs text-muted-foreground/80 pl-1">Loading…</p>
          ) : txns.length === 0 ? (
            <p className="text-xs text-muted-foreground/80 pl-1">No transactions recorded yet.</p>
          ) : (
            txns.map(t => {
              const isSeed = t.notes === SEED_TXN_NOTE;
              const isBuy  = t.transactionType === "BUY";
              const total  = t.quantity * t.pricePerShare;
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 bg-muted/30 rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isSeed
                      ? <Flag className="w-3 h-3 text-indigo-500 shrink-0" />
                      : isBuy
                        ? <ArrowUpCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                        : <ArrowDownCircle className="w-3 h-3 text-red-500 shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("text-xs font-medium",
                          isSeed ? "text-indigo-600 dark:text-indigo-400" : isBuy ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                          {isSeed ? "Opening position" : isBuy ? "Buy" : "Sell"}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">{formatDate(t.transactionDate)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 tabular-nums">
                        {fmtNum(t.quantity)} sh × {fmtExact(t.pricePerShare)}
                        {t.brokerage > 0 && ` · brokerage ${fmt(t.brokerage)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold tabular-nums text-foreground">{fmt(total)}</span>
                    <button onClick={() => setDeleteId(t.id)} aria-label="Delete transaction"
                      className="text-muted-foreground/50 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {deleteId !== null && (
        <ConfirmDialog open title="Delete this transaction?"
          description="Units and average price for this holding will be recalculated from the remaining transactions. This can't be undone."
          confirmLabel={deleting ? "Deleting…" : "Delete"} danger
          onConfirm={() => deleteTxn({ investmentId, txnId: deleteId }, { onSuccess: () => setDeleteId(null) })}
          onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}
