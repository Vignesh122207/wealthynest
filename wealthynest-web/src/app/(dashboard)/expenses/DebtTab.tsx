"use client";

import { useState } from "react";
import {
  Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp,
  User, Phone, CheckCircle2, AlertCircle, Clock,
  ArrowUpRight, ArrowDownLeft, Wallet,
} from "lucide-react";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { cn, formatCurrency } from "@/lib/utils";
import {
  useDebts, useCreateDebt, useUpdateDebt, useRecordDebtPayment, useSettleDebt, useDeleteDebt,
} from "@/features/debts/hooks/useDebts";
import type { DebtRecord, DebtType } from "@/features/debts/types/debt.types";
import { useAccounts } from "@/features/accounts/hooks/useAccounts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DebtRecord["status"] }) {
  if (status === "SETTLED")
    return <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Settled</span>;
  if (status === "PARTIAL")
    return <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400"><Clock className="w-3 h-3" /> Partial</span>;
  return <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400"><AlertCircle className="w-3 h-3" /> Active</span>;
}

// ── Debt Form Modal ───────────────────────────────────────────────────────────

type AccountOption = { id: string; name: string };

function DebtFormModal({ initial, defaultType, accounts, onSave, onClose, saving }: {
  initial?: Partial<DebtRecord>;
  defaultType?: DebtType;
  accounts: AccountOption[];
  onSave: (v: { type: DebtType; contactName: string; contactPhone: string; amount: number; description: string; dueDate: string; accountId?: string }) => void;
  onClose: () => void;
  saving: boolean;
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isEdit ? "Edit Record" : type === "LENT" ? "Record Money Lent" : "Record Money Borrowed"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Track who owes you or who you owe</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {!isEdit && (
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            {(["LENT", "BORROWED"] as DebtType[]).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={cn("flex-1 h-9 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
                  type === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {t === "LENT" ? <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" /> : <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />}
                {t === "LENT" ? "I Lent Money" : "I Borrowed Money"}
              </button>
            ))}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {type === "LENT" ? "Person you lent to" : "Person you borrowed from"}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Name"
                className="w-full h-10 pl-8 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone <span className="text-muted-foreground/40">(optional)</span></label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Phone number"
                className="w-full h-10 pl-8 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/60">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} onFocus={e => e.target.select()} placeholder="0"
                className="w-full h-10 pl-6 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
            </div>
          </div>
          <div>
            <FormDatePicker
              label="Due Date (optional)"
              value={dueDate}
              onChange={v => setDueDate(v)}
              placeholder="Select due date"
            />
          </div>
        </div>

        {!isEdit && accounts.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              <span className="flex items-center gap-1"><Wallet className="w-3 h-3" /> Link to Account <span className="text-muted-foreground/40">(optional)</span></span>
            </label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground outline-none focus:border-indigo-500 transition-all">
              <option value="">None — track only, don't affect balance</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {accountId && (
              <p className="text-[10px] text-indigo-500/80 mt-1.5">
                {type === "LENT" ? "Amount will be debited from this account immediately." : "Amount will be credited to this account immediately."}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note <span className="text-muted-foreground/40">(optional)</span></label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What's it for?"
            className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} type="button"
            className="h-10 px-5 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
            Cancel
          </button>
          <button
            onClick={() => valid && onSave({ type, contactName, contactPhone, amount: Number(amount), description, dueDate, accountId: accountId || undefined })}
            disabled={saving || !valid} type="button"
            className={cn("flex-1 h-10 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-60 flex items-center justify-center gap-1.5",
              !isEdit && type === "LENT" ? "bg-rose-500 hover:bg-rose-600" : !isEdit ? "bg-emerald-600 hover:bg-emerald-500" : "bg-indigo-600 hover:bg-indigo-500")}>
            <Check className="w-3.5 h-3.5" />
            {saving ? "Saving…" : isEdit ? "Save Changes" : (type === "LENT" ? "Record Debt Given" : "Record Debt Taken")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Payment Modal ─────────────────────────────────────────────────────────────

function PaymentModal({ debt, onSave, onClose, saving }: {
  debt: DebtRecord; onSave: (amount: number, note: string) => void; onClose: () => void; saving: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [note,   setNote]   = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Record Payment</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground">
          Remaining: <strong className="text-foreground">{formatCurrency(debt.amountRemaining)}</strong> out of {formatCurrency(debt.amount)}{" "}
          {debt.type === "LENT" ? "lent to" : "borrowed from"} <strong className="text-foreground">{debt.contactName}</strong>
          {debt.accountName && <span className="ml-1 text-muted-foreground/60">· linked to {debt.accountName}</span>}
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Payment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/60">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} onFocus={e => e.target.select()} placeholder="0"
                className="w-full h-10 pl-6 pr-3 rounded-xl text-sm bg-background border border-border text-foreground outline-none focus:border-indigo-500 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note <span className="text-muted-foreground/40">(optional)</span></label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. UPI payment"
              className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
          </div>
        </div>
        {debt.accountName && Number(amount) > 0 && (
          <p className="text-[10px] text-indigo-500/80">
            {debt.type === "LENT" ? `${formatCurrency(Number(amount))} will be credited back to ${debt.accountName}.` : `${formatCurrency(Number(amount))} will be debited from ${debt.accountName}.`}
          </p>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">Cancel</button>
          <button onClick={() => Number(amount) > 0 && onSave(Number(amount), note)} disabled={saving || !amount || Number(amount) <= 0}
            className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60">
            {saving ? "Saving…" : "Record"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Debt Card ─────────────────────────────────────────────────────────────────

function DebtCard({ debt, onEdit, onDelete, onSettle, onPayment, settling }: {
  debt: DebtRecord; onEdit: () => void; onDelete: () => void; onSettle: () => void; onPayment: () => void; settling: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLent    = debt.type === "LENT";
  const isSettled = debt.status === "SETTLED";
  const pct       = debt.amount > 0 ? (debt.amountSettled / debt.amount) * 100 : 0;

  return (
    <div className={cn("bg-card border rounded-2xl overflow-hidden transition-all", isSettled ? "border-border opacity-70" : "border-border")}>
      <div className={cn("h-1", isLent ? "bg-rose-500" : "bg-emerald-500")} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", isLent ? "bg-rose-500/10" : "bg-emerald-500/10")}>
            {isLent ? <ArrowUpRight className="w-5 h-5 text-rose-500" /> : <ArrowDownLeft className="w-5 h-5 text-emerald-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{debt.contactName}</p>
              <StatusBadge status={debt.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLent ? "You lent" : "You borrowed"} {formatCurrency(debt.amount)}
              {debt.dueDate && <span className="ml-2 text-muted-foreground/50">· Due {new Date(debt.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
            </p>
            {debt.accountName && (
              <p className="flex items-center gap-1 text-[10px] text-indigo-500/70 mt-0.5"><Wallet className="w-2.5 h-2.5" /> {debt.accountName}</p>
            )}
            {debt.description && <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{debt.description}</p>}
            {!isSettled && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Settled {formatCurrency(debt.amountSettled)}</span>
                  <span>Remaining {formatCurrency(debt.amountRemaining)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", isLent ? "bg-rose-400" : "bg-emerald-500")} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isSettled && (
              <>
                <button onClick={onPayment} className="h-8 px-2.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-all">Pay</button>
                <button onClick={onSettle} disabled={settling} className="h-8 px-2.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all disabled:opacity-60">Settle</button>
              </>
            )}
            <button onClick={onEdit} className="w-8 h-8 rounded-lg text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10 flex items-center justify-center transition-all"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} className="w-8 h-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        {debt.payments.length > 0 && (
          <>
            <button onClick={() => setExpanded(v => !v)} className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {debt.payments.length} payment{debt.payments.length !== 1 ? "s" : ""}
            </button>
            {expanded && (
              <div className="mt-2 space-y-1.5 border-t border-border pt-3">
                {debt.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>{p.note || "Payment"}</span>
                      <span className="text-muted-foreground/50">{new Date(p.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</span>
                    </div>
                    <span className="font-medium text-foreground">{formatCurrency(p.amount)}</span>
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

// ── Summary Bar ───────────────────────────────────────────────────────────────

function SummaryBar({ debts }: { debts: DebtRecord[] }) {
  const active    = debts.filter(d => d.status !== "SETTLED");
  const lentAmt   = active.filter(d => d.type === "LENT")    .reduce((s, d) => s + d.amountRemaining, 0);
  const borrowAmt = active.filter(d => d.type === "BORROWED").reduce((s, d) => s + d.amountRemaining, 0);
  const net       = lentAmt - borrowAmt;
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3 text-center">
        <p className="text-[10px] text-muted-foreground mb-1">You're owed</p>
        <p className="text-base font-bold text-rose-500 tabular-nums">{formatCurrency(lentAmt)}</p>
      </div>
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3 text-center">
        <p className="text-[10px] text-muted-foreground mb-1">You owe</p>
        <p className="text-base font-bold text-emerald-600 tabular-nums">{formatCurrency(borrowAmt)}</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-3 text-center">
        <p className="text-[10px] text-muted-foreground mb-1">Net position</p>
        <p className={cn("text-base font-bold tabular-nums", net >= 0 ? "text-indigo-500" : "text-amber-500")}>
          {net >= 0 ? "+" : ""}{formatCurrency(Math.abs(net))}
        </p>
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

type DebtTab = "ALL" | "LENT" | "BORROWED";
type ModalState = null | { mode: "create"; defaultType: DebtType } | { mode: "edit"; debt: DebtRecord };

export default function DebtTab() {
  const [tab,       setTab]       = useState<DebtTab>("ALL");
  const [modal,     setModal]     = useState<ModalState>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const { data: debts = [], isLoading } = useDebts();
  const { data: accountsData }          = useAccounts();
  const accounts: AccountOption[] = (accountsData ?? [])
    .filter(a => !a.archived && a.accountType !== "CREDIT_CARD")
    .map(a => ({ id: a.id, name: a.name }));

  const { mutate: createDebt, isPending: creating } = useCreateDebt();
  const { mutate: updateDebt, isPending: updating } = useUpdateDebt();
  const { mutate: recordPay,  isPending: paying    } = useRecordDebtPayment();
  const { mutate: settleDebt, isPending: settling  } = useSettleDebt();
  const { mutate: deleteDebt, isPending: deleting  } = useDeleteDebt();

  const filtered = tab === "ALL" ? debts : debts.filter(d => d.type === tab);
  const payDebt  = debts.find(d => d.id === paymentId);
  const delDebt  = debts.find(d => d.id === deleteId);

  const tabs: { id: DebtTab; label: string; count: number }[] = [
    { id: "ALL",      label: "All",      count: debts.length },
    { id: "LENT",     label: "Lent",     count: debts.filter(d => d.type === "LENT").length },
    { id: "BORROWED", label: "Borrowed", count: debts.filter(d => d.type === "BORROWED").length },
  ];

  return (
    <div className="space-y-4">
      {/* Summary */}
      {debts.length > 0 && <SummaryBar debts={debts} />}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("h-8 px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t.label}
              {t.count > 0 && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full",
                  tab === t.id ? "bg-muted text-muted-foreground" : "bg-background/60 text-muted-foreground")}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={() => setModal({ mode: "create", defaultType: "BORROWED" })}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all">
            <Plus className="w-3.5 h-3.5" /> Borrowed
          </button>
          <button onClick={() => setModal({ mode: "create", defaultType: "LENT" })}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium bg-rose-500 hover:bg-rose-600 text-white transition-all">
            <Plus className="w-3.5 h-3.5" /> Lent
          </button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-28 bg-card border border-border rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
            <User className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-foreground">No debt records</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">Track money you've lent or borrowed.</p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setModal({ mode: "create", defaultType: "LENT" })}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-medium bg-rose-500 hover:bg-rose-600 text-white transition-all">
              <ArrowUpRight className="w-4 h-4" /> I Lent
            </button>
            <button onClick={() => setModal({ mode: "create", defaultType: "BORROWED" })}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all">
              <ArrowDownLeft className="w-4 h-4" /> I Borrowed
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(debt => (
            <DebtCard key={debt.id} debt={debt} settling={settling}
              onEdit={() => setModal({ mode: "edit", debt })}
              onDelete={() => setDeleteId(debt.id)}
              onSettle={() => settleDebt(debt.id)}
              onPayment={() => setPaymentId(debt.id)}
            />
          ))}
        </div>
      )}

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

      {/* Payment modal */}
      {paymentId && payDebt && (
        <PaymentModal debt={payDebt} saving={paying} onClose={() => setPaymentId(null)}
          onSave={(amount, note) => recordPay({ id: paymentId, payload: { amount, note } }, { onSuccess: () => setPaymentId(null) })} />
      )}

      {/* Delete confirm */}
      {deleteId && delDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0"><Trash2 className="w-4 h-4 text-red-500" /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Delete this record?</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  The debt record for <strong>{delDebt.contactName}</strong> ({formatCurrency(delDebt.amount)}) and all payment history will be permanently removed.
                </p>
              </div>
              <button onClick={() => setDeleteId(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 h-10 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">Cancel</button>
              <button onClick={() => deleteDebt(deleteId, { onSuccess: () => setDeleteId(null) })} disabled={deleting}
                className="flex-1 h-10 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-60">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
