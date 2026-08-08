"use client";

import {useRef, useState} from "react";
import {Image as ImageIcon, MapPin, Paperclip, Pencil, Split, Trash2, X} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {CategoryTrendChart} from "@/features/expenses/components/CategoryTrendChart";
import {buildCategoryTrend} from "@/features/expenses/utils/categoryTrend";
import {useReceiptAttachment} from "@/features/expenses/hooks/useReceiptAttachment";
import {useExpenseSplitsForExpense, useAddExpenseSplits} from "@/features/expensesplits/hooks/useExpenseSplits";
import {getCategoryColor, getCategoryIcon} from "@/lib/categoryMeta";
import {formatDate} from "@/lib/utils";
import type {Expense} from "@/features/expenses/types/expense.types";

interface TransactionDetailDrawerProps {
  expense: Expense;
  accountName: string | undefined;
  familyMembers: { id: string; fullName: string }[];
  allTimeExpenses: Expense[];
  fmt: (amount: number) => string;
  onClose: () => void;
  onEdit: () => void;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash", CREDIT_CARD: "Credit Card", BANK_ACCOUNT: "Bank Account",
};

/** Right-side detail drawer for a single expense — merchant summary, a real per-transaction split
 * utility, and a category spend trend chart. Also shows a client-side receipt attachment and,
 * when the expense has one, the location captured at entry time (opt-in, via the expense form's
 * "Add current location" button — most expenses won't have one, so that section only renders when
 * real coordinates exist). Expense-only: income/transfer rows still open the existing edit modal
 * directly, since merchant/receipt/split/location are expense-specific concepts that don't apply
 * to those. */
export function TransactionDetailDrawer({ expense, accountName, familyMembers, allTimeExpenses, fmt, onClose, onEdit }: TransactionDetailDrawerProps) {
  const catIcon  = getCategoryIcon({ name: expense.categoryName ?? "", icon: expense.categoryIcon });
  const catColor = getCategoryColor(expense.categoryName ?? "", expense.categoryColor);
  const title = expense.description || expense.categoryName || "Expense";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { dataUrl: receiptUrl, attach, remove: removeReceipt } = useReceiptAttachment(expense.id);

  const { data: splits = [] } = useExpenseSplitsForExpense(expense.id);
  const { mutate: addSplits, isPending: addingSplit } = useAddExpenseSplits(expense.id);
  const [splitUserId, setSplitUserId] = useState("");
  const [splitAmount, setSplitAmount] = useState("");

  const alreadySplit = splits.reduce((s, x) => s + x.shareAmount, 0);
  const remaining = Math.max(0, expense.amount - alreadySplit);

  const trend = buildCategoryTrend(allTimeExpenses, expense.categoryId, 6, new Date());

  const handleAddSplit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(splitAmount);
    if (!splitUserId || !amount || amount <= 0) return;
    addSplits([{ userId: splitUserId, shareAmount: amount }], {
      onSuccess: () => { setSplitUserId(""); setSplitAmount(""); },
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] lg:w-[35vw] lg:min-w-[440px] lg:max-w-[600px] bg-background sm:border-l border-border shadow-2xl flex flex-col"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500 shrink-0" />
        <div className="flex items-center gap-3 px-5 h-16 border-b border-border shrink-0">
          <PremiumIcon icon={catIcon} hex={catColor} size="md" />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-foreground truncate">{title}</h3>
            <p className="text-xs text-muted-foreground">{formatDate(expense.expenseDate)}</p>
          </div>
          <button onClick={onEdit} aria-label="Edit transaction"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Amount + meta */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-2xl font-bold text-red-500 dark:text-red-400 tabular-nums">−{fmt(expense.amount)}</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {expense.categoryName && (
                <div><p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">Category</p>
                  <p className="text-sm text-foreground font-medium truncate">{expense.categoryName}</p></div>
              )}
              {accountName && (
                <div><p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">Account</p>
                  <p className="text-sm text-foreground font-medium truncate">{accountName}</p></div>
              )}
              {expense.paymentMethod && (
                <div><p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">Payment method</p>
                  <p className="text-sm text-foreground font-medium truncate">{PAYMENT_METHOD_LABELS[expense.paymentMethod] ?? expense.paymentMethod}</p></div>
              )}
              {expense.recurring && (
                <div><p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">Recurring</p>
                  <p className="text-sm text-foreground font-medium">Yes</p></div>
              )}
            </div>
            {expense.notes && <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/60">{expense.notes}</p>}
          </div>

          {/* Location — only rendered when this expense actually has one (opt-in, captured via the
              expense form's "Add current location" button) rather than showing an empty
              placeholder on every transaction that never set it. Raw coordinates only (Tier 1):
              a "View on map" link opens the coordinates in the browser's default maps handler
              rather than rendering an embedded map in-app. */}
          {expense.latitude != null && expense.longitude != null && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <PremiumIcon icon={MapPin} tone="red" size="xs" />
                <h4 className="text-sm font-semibold text-foreground">Location</h4>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground tabular-nums">{expense.latitude.toFixed(5)}, {expense.longitude.toFixed(5)}</p>
                <a href={`https://www.google.com/maps?q=${expense.latitude},${expense.longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-indigo-500 hover:text-indigo-600 transition-colors shrink-0">
                  View on map →
                </a>
              </div>
            </div>
          )}

          {/* Receipt attachment — client-side only (useReceiptAttachment/localStorage), visible on
              this device/browser only, not synced across devices. */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <PremiumIcon icon={Paperclip} tone="orange" size="xs" />
              <h4 className="text-sm font-semibold text-foreground">Receipt</h4>
              <span className="text-[10px] text-muted-foreground/60 ml-auto">Saved on this device</span>
            </div>
            {receiptUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a browser-local data URL, not a remote/optimizable image */}
                <img src={receiptUrl} alt="Receipt" className="w-full max-h-48 object-contain rounded-xl border border-border" />
                <button onClick={removeReceipt} aria-label="Remove receipt"
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full h-20 rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-indigo-500/40 transition-colors">
                <ImageIcon className="w-5 h-5" />
                <span className="text-[11px]">Attach a receipt photo</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) attach(f); e.target.value = ""; }} />
          </div>

          {/* Split transaction */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <PremiumIcon icon={Split} tone="purple" size="xs" />
              <h4 className="text-sm font-semibold text-foreground">Split this transaction</h4>
            </div>
            {!expense.familyId ? (
              <p className="text-xs text-muted-foreground">Join a family group to split expenses with others.</p>
            ) : (
              <div className="space-y-2.5">
                {splits.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{s.participantName}</span>
                    <span className="text-muted-foreground tabular-nums">{fmt(s.shareAmount)} · {s.status === "PENDING" ? "Pending" : "Settled"}</span>
                  </div>
                ))}
                {remaining > 0 && familyMembers.length > 0 && (
                  <form onSubmit={handleAddSplit} className="flex items-center gap-2 pt-2 border-t border-border/60">
                    <select value={splitUserId} onChange={e => setSplitUserId(e.target.value)} required
                      className="flex-1 h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground">
                      <option value="">Split with…</option>
                      {familyMembers.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                    </select>
                    <input type="number" min={0.01} max={remaining} step="0.01" value={splitAmount}
                      onChange={e => setSplitAmount(e.target.value)} placeholder={fmt(remaining)} required
                      className="w-24 h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground" />
                    <button type="submit" disabled={addingSplit}
                      className="h-8 px-3 rounded-lg bg-indigo-500 text-white text-xs font-medium disabled:opacity-50">
                      Add
                    </button>
                  </form>
                )}
                {splits.length === 0 && remaining === expense.amount && familyMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground">No other family members to split with yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Category trend */}
          {expense.categoryName && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-1">{expense.categoryName} — last 6 months</h4>
              <CategoryTrendChart data={trend} fmt={fmt} color={catColor} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
