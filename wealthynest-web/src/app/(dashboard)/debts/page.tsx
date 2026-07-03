"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import {
  Plus, Pencil, Trash2, X, Check,
  ChevronDown, ChevronUp, User, Phone,
  CheckCircle2, AlertCircle, Clock,
  ArrowUpRight, ArrowDownLeft, Wallet,
} from "lucide-react";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { cn, formatCurrency } from "@/lib/utils";
import {
  useDebts, useCreateDebt, useUpdateDebt,
  useRecordDebtPayment, useDeleteDebt,
} from "@/features/debts/hooks/useDebts";
import type { DebtRecord, DebtType } from "@/features/debts/types/debt.types";
import { useAccounts } from "@/features/accounts/hooks/useAccounts";

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DebtRecord["status"] }) {
  if (status === "SETTLED")
    return <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" />Settled</span>;
  if (status === "PARTIAL")
    return <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"><Clock className="w-3 h-3" />Partial</span>;
  return <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400"><AlertCircle className="w-3 h-3" />Active</span>;
}

// ── Debt Form Modal ───────────────────────────────────────────────────────────

function DebtFormModal({ initial, defaultType, accounts, onSave, onClose, saving }: {
  initial?:     Partial<DebtRecord>;
  defaultType?: DebtType;
  accounts:     { id: string; name: string }[];
  onSave:       (v: { type: DebtType; contactName: string; contactPhone: string; amount: number; description: string; dueDate: string; accountId?: string }) => void;
  onClose:      () => void;
  saving:       boolean;
}) {
  const isEdit = !!initial?.id;
  const [type,         setType]         = useState<DebtType>(initial?.type ?? defaultType ?? "LENT");
  const [contactName,  setContactName]  = useState(initial?.contactName  ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [amount,       setAmount]       = useState(initial?.amount?.toString() ?? "");
  const [description,  setDescription]  = useState(initial?.description  ?? "");
  const [dueDate,      setDueDate]      = useState(initial?.dueDate?.slice(0, 10) ?? "");
  const [accountId,    setAccountId]    = useState(initial?.accountId ?? "");

  const valid = contactName.trim() && Number(amount) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[95dvh] overflow-y-auto">
        {/* drag handle on mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="px-5 pb-6 pt-2 sm:p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">
                {isEdit ? "Edit Debt" : type === "LENT" ? "I Lent Money" : "I Borrowed Money"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEdit ? "Update debt details" : type === "LENT" ? "Someone owes you money" : "You owe someone money"}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Type toggle — only on create */}
          {!isEdit && (
            <div className="flex rounded-2xl bg-muted p-1 gap-1">
              <button type="button" onClick={() => setType("LENT")}
                className={cn(
                  "flex-1 h-10 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                  type === "LENT"
                    ? "bg-teal-600 text-white shadow-sm shadow-teal-600/30"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                <ArrowUpRight className="w-4 h-4" /> I Lent
              </button>
              <button type="button" onClick={() => setType("BORROWED")}
                className={cn(
                  "flex-1 h-10 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                  type === "BORROWED"
                    ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                <ArrowDownLeft className="w-4 h-4" /> I Borrowed
              </button>
            </div>
          )}

          {/* Amount — large and prominent */}
          <div className="bg-muted/50 rounded-2xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-2">Amount</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-xl text-muted-foreground font-medium">₹</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onFocus={e => e.target.select()}
                placeholder="0"
                className="text-3xl font-bold text-foreground bg-transparent outline-none w-full text-center placeholder-muted-foreground/30 tabular-nums"
              />
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {type === "LENT" ? "Who did you lend to?" : "Who did you borrow from?"}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Name"
                  className="w-full h-11 pl-9 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone <span className="text-muted-foreground/60">(optional)</span></label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                  <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Number"
                    className="w-full h-11 pl-8 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Due Date <span className="text-muted-foreground/60">(optional)</span></label>
                <FormDatePicker value={dueDate} onChange={v => setDueDate(v)} placeholder="Pick date" />
              </div>
            </div>

            {/* Account linking */}
            {!isEdit && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" />
                  Linked Account <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl text-sm bg-background border border-border text-foreground outline-none focus:border-indigo-500 transition-all">
                  <option value="">None — track only</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {accountId && (
                  <p className="text-[11px] mt-1.5 px-1 text-indigo-500/80">
                    {type === "LENT"
                      ? `₹${amount || "0"} will be debited from this account`
                      : `₹${amount || "0"} will be credited to this account`}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note <span className="text-muted-foreground/60">(optional)</span></label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What's it for?"
                className="w-full h-11 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} type="button"
              className="h-12 px-5 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
            <button
              onClick={() => valid && onSave({ type, contactName, contactPhone, amount: Number(amount), description, dueDate, accountId: accountId || undefined })}
              disabled={saving || !valid} type="button"
              className={cn(
                "flex-1 h-12 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2",
                !isEdit && type === "LENT" ? "bg-teal-600 hover:bg-teal-500" : !isEdit ? "bg-amber-600 hover:bg-amber-500" : "bg-indigo-600 hover:bg-indigo-500"
              )}>
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {saving ? "Saving…" : isEdit ? "Save Changes" : (type === "LENT" ? "Add Debt Given" : "Add Debt Taken")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Payment / Received Modal ──────────────────────────────────────────────────

function PaymentModal({ debt, onSave, onClose, saving }: {
  debt:    DebtRecord;
  onSave:  (amount: number, note: string) => void;
  onClose: () => void;
  saving:  boolean;
}) {
  const isLent = debt.type === "LENT";
  const [amount, setAmount] = useState(debt.amountRemaining.toString());
  const [note,   setNote]   = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="px-5 pb-6 pt-2 sm:p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">
                {isLent ? "Mark as Received" : "Record Payment"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isLent
                  ? `Receiving from ${debt.contactName}`
                  : `Paying back ${debt.contactName}`}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-muted/50 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{formatCurrency(debt.amount)}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-muted-foreground">Remaining</span>
              <span className={cn("font-bold", isLent ? "text-rose-500" : "text-amber-500")}>
                {formatCurrency(debt.amountRemaining)}
              </span>
            </div>
            {debt.accountName && (
              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                <Wallet className="w-3 h-3" /> {debt.accountName}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {isLent ? "Amount Received" : "Amount Paying"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/80">₹</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  onFocus={e => e.target.select()} placeholder="0"
                  className="w-full h-11 pl-6 pr-3 rounded-xl text-sm bg-background border border-border text-foreground outline-none focus:border-indigo-500 transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note <span className="text-muted-foreground/60">(optional)</span></label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. UPI transfer"
                className="w-full h-11 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
            </div>
          </div>

          {debt.accountName && Number(amount) > 0 && (
            <p className="text-[11px] text-indigo-500/80 px-1">
              {isLent
                ? `${formatCurrency(Number(amount))} will be credited back to ${debt.accountName}`
                : `${formatCurrency(Number(amount))} will be debited from ${debt.accountName}`}
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={onClose}
              className="h-12 px-5 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
            <button onClick={() => Number(amount) > 0 && onSave(Number(amount), note)}
              disabled={saving || !amount || Number(amount) <= 0}
              className={cn(
                "flex-1 h-12 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2",
                isLent ? "bg-emerald-600 hover:bg-emerald-500" : "bg-indigo-600 hover:bg-indigo-500"
              )}>
              {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Saving…" : isLent ? "Mark Received" : "Record Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Debt Card ─────────────────────────────────────────────────────────────────

function DebtCard({ debt, onEdit, onDelete, onPayment }: {
  debt:      DebtRecord;
  onEdit:    () => void;
  onDelete:  () => void;
  onPayment: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLent    = debt.type === "LENT";
  const isSettled = debt.status === "SETTLED";
  const pct       = debt.amount > 0 ? Math.min((debt.amountSettled / debt.amount) * 100, 100) : 0;

  return (
    <div className={cn(
      "bg-card border rounded-2xl overflow-hidden transition-all",
      isSettled ? "border-border/50 opacity-60" : isLent ? "border-teal-500/20" : "border-amber-500/20"
    )}>
      {/* color strip */}
      <div className={cn("h-0.5", isLent ? "bg-teal-500" : "bg-amber-500")} />

      <div className="p-4">
        <div className="flex gap-2 sm:gap-3">
          {/* Avatar */}
          <div className={cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-base font-bold",
            isLent ? "bg-teal-500/10 text-teal-600" : "bg-amber-500/10 text-amber-600"
          )}>
            {debt.contactName.charAt(0).toUpperCase()}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight truncate">{debt.contactName}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isLent ? "You lent" : "You borrowed"} · {debt.dueDate
                    ? `Due ${new Date(debt.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : "No due date"}
                </p>
                {debt.dueDate && new Date(debt.dueDate) < new Date() && debt.status !== "SETTLED" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 font-medium">Overdue</span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <p className={cn("text-base font-bold tabular-nums", isLent ? "text-teal-600" : "text-amber-600")}>
                  {formatCurrency(debt.amount)}
                </p>
                <StatusBadge status={debt.status} />
              </div>
            </div>

            {/* Linked account */}
            {debt.accountName && (
              <div className="flex items-center gap-1 mt-1.5">
                <Wallet className="w-3 h-3 text-indigo-500/60 shrink-0" />
                <span className="text-[11px] text-indigo-500/70">{debt.accountName}</span>
              </div>
            )}

            {debt.description && (
              <p className="text-xs text-muted-foreground/80 mt-1 truncate">{debt.description}</p>
            )}

            {/* Progress */}
            {!isSettled && debt.amount > 0 && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{isLent ? "Received" : "Paid"} {formatCurrency(debt.amountSettled)}</span>
                  <span>Left {formatCurrency(debt.amountRemaining)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-500",
                    pct >= 70 ? "bg-emerald-500" : pct >= 30 ? "bg-amber-500" : "bg-red-500"
                  )}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            {/* Actions */}
            {!isSettled && (
              <div className="flex items-center gap-2 mt-3">
                <button onClick={onPayment}
                  className={cn(
                    "flex-1 h-9 rounded-xl text-xs font-semibold transition-all",
                    isLent
                      ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      : "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20"
                  )}>
                  {isLent ? "✓ Received" : "↑ Pay Back"}
                </button>
              </div>
            )}
          </div>

          {/* Edit / Delete */}
          <div className="flex flex-col gap-1 shrink-0">
            <button onClick={onEdit}
              className="w-8 h-8 rounded-xl text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10 flex items-center justify-center transition-all">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete}
              className="w-8 h-8 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Payment history */}
        {debt.payments.length > 0 && (
          <>
            <button onClick={() => setExpanded(v => !v)}
              className="mt-3 w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted/40 rounded-xl px-3 py-2">
              <span>{debt.payments.length} payment{debt.payments.length !== 1 ? "s" : ""}</span>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {expanded && (
              <div className="mt-2 space-y-1.5 border-t border-border/50 pt-3">
                {debt.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="truncate">{p.note || "Payment"}</span>
                      <span className="text-muted-foreground/50 shrink-0">
                        {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <span className="font-semibold text-foreground shrink-0 ml-2">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────

function Summary({ debts }: { debts: DebtRecord[] }) {
  const active    = debts.filter(d => d.status !== "SETTLED");
  const lentAmt   = active.filter(d => d.type === "LENT")    .reduce((s, d) => s + d.amountRemaining, 0);
  const borrowAmt = active.filter(d => d.type === "BORROWED").reduce((s, d) => s + d.amountRemaining, 0);
  const net       = lentAmt - borrowAmt;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3 sm:p-4">
        <p className="text-xs text-muted-foreground mb-1">You're owed</p>
        <p className="text-lg font-bold text-rose-500 tabular-nums">{formatCurrency(lentAmt)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {active.filter(d => d.type === "LENT").length} active
        </p>
      </div>
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 sm:p-4">
        <p className="text-xs text-muted-foreground mb-1">You owe</p>
        <p className="text-lg font-bold text-amber-600 tabular-nums">{formatCurrency(borrowAmt)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {active.filter(d => d.type === "BORROWED").length} active
        </p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-3 sm:p-4">
        <p className="text-xs text-muted-foreground mb-1">Net</p>
        <p className={cn("text-lg font-bold tabular-nums", net >= 0 ? "text-emerald-500" : "text-rose-500")}>
          {net >= 0 ? "+" : ""}{formatCurrency(Math.abs(net))}
        </p>
        <p className={cn("text-xs mt-0.5", net >= 0 ? "text-emerald-500/70" : "text-rose-500/70")}>
          {net >= 0 ? "in your favour" : "you owe more"}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "ALL" | "LENT" | "BORROWED";
type Modal = null
  | { mode: "create"; defaultType: DebtType }
  | { mode: "edit";   debt: DebtRecord };

export default function DebtsPage() {
  const [tab,       setTab]       = useState<Tab>("ALL");
  const [modal,     setModal]     = useState<Modal>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const { data: debts = [], isLoading }   = useDebts();
  const { data: accountsData }            = useAccounts();
  const accounts = (accountsData ?? []).filter(a => !a.archived && a.accountType !== "CREDIT_CARD").map(a => ({ id: a.id, name: a.name }));

  const { mutate: createDebt, isPending: creating } = useCreateDebt();
  const { mutate: updateDebt, isPending: updating } = useUpdateDebt();
  const { mutate: recordPay,  isPending: paying    } = useRecordDebtPayment();
  const { mutate: deleteDebt }                       = useDeleteDebt();

  const filtered = tab === "ALL" ? debts : debts.filter(d => d.type === tab);
  const payDebt  = debts.find(d => d.id === paymentId);
  const delDebt  = debts.find(d => d.id === deleteId);

  const tabs: { id: Tab; label: string; icon: string; count: number }[] = [
    { id: "ALL",      label: "All",      icon: "🧾", count: debts.length },
    { id: "LENT",     label: "Lent",     icon: "↑",  count: debts.filter(d => d.type === "LENT").length },
    { id: "BORROWED", label: "Borrowed", icon: "↓",  count: debts.filter(d => d.type === "BORROWED").length },
  ];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Debt Tracker" />
      <PageWrapper>

        {debts.length > 0 && <Summary debts={debts} />}

        {/* Tabs + Add buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl bg-muted p-1 gap-0.5 flex-1 sm:flex-none">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  "flex-1 sm:flex-none h-9 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
                  tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}>
                <span className="hidden sm:inline">{t.icon}</span> {t.label}
                {t.count > 0 && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full tabular-nums",
                    tab === t.id ? "bg-muted text-muted-foreground" : "bg-background/60 text-muted-foreground")}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex gap-2 ml-auto">
            <button onClick={() => setModal({ mode: "create", defaultType: "BORROWED" })}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">I </span>Borrowed
            </button>
            <button onClick={() => setModal({ mode: "create", defaultType: "LENT" })}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-all">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">I </span>Lent
            </button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-card border border-border rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
              <span className="text-3xl">🤝</span>
            </div>
            <p className="text-sm font-semibold text-foreground">No debts here</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {tab === "LENT" ? "You haven't lent any money yet." :
               tab === "BORROWED" ? "You haven't borrowed any money yet." :
               "Track money lent to others or borrowed from someone."}
            </p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal({ mode: "create", defaultType: "LENT" })}
                className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-all">
                <ArrowUpRight className="w-4 h-4" /> I Lent
              </button>
              <button onClick={() => setModal({ mode: "create", defaultType: "BORROWED" })}
                className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all">
                <ArrowDownLeft className="w-4 h-4" /> I Borrowed
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(debt => (
              <DebtCard
                key={debt.id}
                debt={debt}
                onEdit={() => setModal({ mode: "edit", debt })}
                onDelete={() => setDeleteId(debt.id)}
                onPayment={() => setPaymentId(debt.id)}
              />
            ))}
          </div>
        )}
      </PageWrapper>

      {/* Debt form modal */}
      {modal !== null && (
        <DebtFormModal
          initial={modal.mode === "edit" ? modal.debt : undefined}
          defaultType={modal.mode === "create" ? modal.defaultType : undefined}
          accounts={accounts}
          saving={modal.mode === "edit" ? updating : creating}
          onClose={() => setModal(null)}
          onSave={v => {
            if (modal.mode === "edit") {
              updateDebt({ id: modal.debt.id, payload: v }, { onSuccess: () => setModal(null) });
            } else {
              createDebt(v, { onSuccess: () => setModal(null) });
            }
          }}
        />
      )}

      {/* Payment / Received modal */}
      {payDebt && (
        <PaymentModal
          debt={payDebt}
          saving={paying}
          onClose={() => setPaymentId(null)}
          onSave={(amt, note) =>
            recordPay({ id: payDebt.id, payload: { amount: amt, note } },
              { onSuccess: () => setPaymentId(null) })
          }
        />
      )}

      {/* Delete confirm */}
      {delDebt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm">
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="px-5 pb-6 pt-2 sm:p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Delete debt record?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {delDebt.type === "LENT" ? "Lent" : "Borrowed"} {formatCurrency(delDebt.amount)} {delDebt.type === "LENT" ? "to" : "from"} <strong className="text-foreground">{delDebt.contactName}</strong>
                </p>
                {delDebt.accountName && (
                  <p className="text-xs text-muted-foreground/80 mt-1">
                    Account balance will be fully reversed, including any payments recorded.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 h-11 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                  Cancel
                </button>
                <button onClick={() => deleteDebt(delDebt.id, { onSuccess: () => setDeleteId(null) })}
                  className="flex-1 h-11 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-all">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
