"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import {
  Check, ChevronDown, ChevronUp, Phone,
  CheckCircle2, AlertCircle, Clock, Handshake,
  ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, Wallet, Trash2, type LucideIcon,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { Button } from "@/components/ui/Button";
import { FormModalShell } from "@/components/ui/Modal";
import { GlossyBadge, TONE_HEX, PremiumIcon, type IconTone } from "@/components/icons/PremiumIcon";
import { AccountPicker } from "@/components/transactions/AccountPicker";
import { FormModalHeader } from "@/components/transactions/FormModalHeader";
import { TransactionModalOverlay } from "@/components/transactions/TransactionModalOverlay";
import { usePrefsStore, CURRENCIES } from "@/store/preferences.store";
import { BigAmountInput } from "@/components/transactions/BigAmountInput";
import { cn, formatCurrency } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";
import {
  useDebts, useCreateDebt, useUpdateDebt,
  useRecordDebtPayment, useDeleteDebt,
} from "@/features/debts/hooks/useDebts";
import { debtSchema, type DebtFormValues } from "@/features/debts/schemas/debt.schema";
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

// ── Contact avatar — monogram badge, consistent with BankLogo's fallback look ──

function ContactAvatar({ name, isLent, size = 44 }: { name: string; isLent: boolean; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <GlossyBadge hex={isLent ? TONE_HEX.emerald : TONE_HEX.red} className="shrink-0" size="md">
      <span className="relative text-white font-bold text-base" style={{ fontSize: size * 0.36 }}>{initial}</span>
    </GlossyBadge>
  );
}

// ── Debt Form Modal ───────────────────────────────────────────────────────────

function DebtFormModal({ initial, defaultType, accounts, onSave, onDelete, onClose, saving }: {
  initial?:     DebtRecord;
  defaultType?: DebtType;
  accounts:     { id: string; name: string; bankName?: string; currentBalance: number; primary?: boolean; accountType: string }[];
  onSave:       (v: DebtFormValues & { type?: DebtType; accountId?: string }) => void;
  onDelete?:    () => void;
  onClose:      () => void;
  saving:       boolean;
}) {
  const today = new Date().toISOString().split("T")[0];
  const isEdit = !!initial?.id;
  const [type,      setType]      = useState<DebtType>(initial?.type ?? defaultType ?? "LENT");
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");

  const cashAccounts = accounts.filter(a => a.accountType === "CASH_WALLET");
  const bankAccounts = accounts.filter(a => a.accountType === "BANK_ACCOUNT");

  const form = useForm<DebtFormValues>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      contactName:  initial?.contactName  ?? "",
      contactPhone: initial?.contactPhone ?? "",
      amount:       initial?.amount as any ?? undefined,
      description:  initial?.description  ?? "",
      debtDate:     initial?.debtDate?.slice(0, 10) ?? today,
      dueDate:      initial?.dueDate?.slice(0, 10)  ?? "",
    },
  });

  const isLent = type === "LENT";
  const submit = (v: DebtFormValues) =>
    onSave(isEdit ? v : { ...v, type, accountId: accountId || undefined });

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <FormModalShell accent={isLent ? "from-emerald-400 to-teal-500" : "from-rose-400 to-red-500"}>
          <FormModalHeader icon={Handshake} tone={isLent ? "emerald" : "red"}
            title={isEdit ? `Edit — ${initial!.contactName}` : type === "LENT" ? "I Lent Money" : "I Borrowed Money"}
            onDelete={onDelete} onClose={onClose} />
          <p className="text-xs text-muted-foreground -mt-3 mb-4">
            {isEdit ? "Update debt details" : type === "LENT" ? "Someone owes you money" : "You owe someone money"}
          </p>

          {/* Type toggle — only on create, styled like Budgets' Monthly/Yearly toggle */}
          {!isEdit && (
            <div className="flex gap-2 mb-4">
              <button type="button" onClick={() => setType("LENT")}
                className={cn("flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium transition-all border",
                  type === "LENT" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                <ArrowUpRight className="w-3.5 h-3.5" /> I Lent
              </button>
              <button type="button" onClick={() => setType("BORROWED")}
                className={cn("flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium transition-all border",
                  type === "BORROWED" ? "bg-rose-600 border-rose-500 text-white" : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                <ArrowDownLeft className="w-3.5 h-3.5" /> I Borrowed
              </button>
            </div>
          )}

          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <BigAmountInput colorClass={isLent ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}
              error={form.formState.errors.amount?.message} inputProps={form.register("amount")} />

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {isLent ? "Who did you lend to?" : "Who did you borrow from?"}
              </label>
              <input placeholder="Name"
                className={cn("w-full h-11 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none transition-all",
                  isLent ? "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40" : "focus:border-red-500 focus:ring-2 focus:ring-red-500/40")}
                {...form.register("contactName")} />
              {form.formState.errors.contactName && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.contactName.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Controller control={form.control} name="debtDate" render={({ field, fieldState }) => (
                <FormDatePicker label={isLent ? "Date Lent" : "Date Borrowed"} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} placeholder="Pick date" />
              )} />
              <Controller control={form.control} name="dueDate" render={({ field, fieldState }) => (
                <FormDatePicker label="Due Date (optional)" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} placeholder="Pick date" />
              )} />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone <span className="text-muted-foreground/60">(optional)</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <input placeholder="Number"
                  className={cn("w-full h-11 pl-8 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none transition-all",
                    isLent ? "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40" : "focus:border-red-500 focus:ring-2 focus:ring-red-500/40")}
                  {...form.register("contactPhone")} />
              </div>
            </div>

            {/* Account linking — creation only, matches UpdateDebtPayload's scope */}
            {!isEdit && (
              <div>
                <AccountPicker label="Linked Account (optional)"
                  cashAccounts={cashAccounts} bankAccounts={bankAccounts} creditAccounts={[]}
                  value={accountId} onChange={setAccountId} />
                {accountId && (
                  <p className="text-[11px] mt-1.5 px-1 text-indigo-500/80">
                    {isLent
                      ? `Amount will be debited from this account`
                      : `Amount will be credited to this account`}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note <span className="text-muted-foreground/60">(optional)</span></label>
              <input placeholder="What's it for?"
                className={cn("w-full h-11 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none transition-all",
                  isLent ? "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40" : "focus:border-red-500 focus:ring-2 focus:ring-red-500/40")}
                {...form.register("description")} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="gradient" loading={saving}
                className={cn("flex-1 disabled:shadow-none",
                  isLent
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/25"
                    : "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 shadow-rose-500/25")}>
                <Check className="w-4 h-4" /> {saving ? "Saving…" : isEdit ? "Save Changes" : isLent ? "Add Debt Given" : "Add Debt Taken"}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            </div>
          </form>
      </FormModalShell>
    </TransactionModalOverlay>
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
  const { currency: currCode } = usePrefsStore();
  const currSymbol = CURRENCIES.find(c => c.code === currCode)?.symbol ?? "₹";

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-2.5 mb-4">
          <ContactAvatar name={debt.contactName} isLent={isLent} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {isLent ? "Mark as Received" : "Record Payment"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {isLent ? `Receiving from ${debt.contactName}` : `Paying back ${debt.contactName}`}
            </p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-xl p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{formatCurrency(debt.amount)}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-muted-foreground">Remaining</span>
            <span className={cn("font-bold", isLent ? "text-emerald-500" : "text-red-500")}>
              {formatCurrency(debt.amountRemaining)}
            </span>
          </div>
          {debt.accountName && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
              <Wallet className="w-3 h-3" /> {debt.accountName}
            </div>
          )}
        </div>

        <div className="space-y-3 mt-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {isLent ? "Amount Received" : "Amount Paying"}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/80">{currSymbol}</span>
              <input type="text" inputMode="decimal" value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                placeholder="0"
                className="w-full h-11 pl-6 pr-3 rounded-xl text-sm bg-background border border-border text-foreground outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note <span className="text-muted-foreground/60">(optional)</span></label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. UPI transfer"
              className="w-full h-11 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all" />
          </div>
        </div>

        {debt.accountName && Number(amount) > 0 && (
          <p className="text-[11px] text-indigo-500/80 px-1 mt-3">
            {isLent
              ? `${formatCurrency(Number(amount))} will be credited back to ${debt.accountName}`
              : `${formatCurrency(Number(amount))} will be debited from ${debt.accountName}`}
          </p>
        )}

        <div className="flex gap-2 mt-4">
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
    </TransactionModalOverlay>
  );
}

// ── Debt Card — whole row clickable to edit; Pay Back / history stay distinct ──

function DebtCard({ debt, onEdit, onPayment }: {
  debt:      DebtRecord;
  onEdit:    () => void;
  onPayment: () => void;
}) {
  const { fmt } = useAmountFormatter();
  const [expanded, setExpanded] = useState(false);
  const isLent    = debt.type === "LENT";
  const isSettled = debt.status === "SETTLED";
  const pct       = debt.amount > 0 ? Math.min((debt.amountSettled / debt.amount) * 100, 100) : 0;

  return (
    <div className={cn(
      "bg-card border rounded-2xl overflow-hidden transition-all",
      isSettled ? "border-border/50 opacity-60" : isLent ? "border-emerald-500/20" : "border-red-500/20"
    )}>
      {/* color strip */}
      <div className={cn("h-0.5", isLent ? "bg-emerald-500" : "bg-red-500")} />

      <button type="button" onClick={onEdit}
        aria-label={`Edit debt with ${debt.contactName}`}
        className="w-full text-left p-4 hover:bg-muted/30 transition-colors">
        <div className="flex gap-2 sm:gap-3">
          <ContactAvatar name={debt.contactName} isLent={isLent} />

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
                <p className={cn("text-base font-bold tabular-nums", isLent ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {fmt(debt.amount)}
                </p>
                <StatusBadge status={debt.status} />
              </div>
            </div>

            {debt.accountName && (
              <div className="flex items-center gap-1 mt-1.5">
                <Wallet className="w-3 h-3 text-indigo-500/60 shrink-0" />
                <span className="text-[11px] text-indigo-500/70">{debt.accountName}</span>
              </div>
            )}

            {debt.description && (
              <p className="text-xs text-muted-foreground/80 mt-1 truncate">{debt.description}</p>
            )}

            {!isSettled && debt.amount > 0 && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{isLent ? "Received" : "Paid"} {fmt(debt.amountSettled)}</span>
                  <span>Left {fmt(debt.amountRemaining)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-500",
                    pct >= 70 ? "bg-emerald-500" : pct >= 30 ? "bg-amber-500" : "bg-red-500"
                  )}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </button>

      <div className="px-4 pb-4 -mt-1 space-y-2">
        {!isSettled && (
          <button onClick={onPayment}
            className={cn(
              "w-full h-9 rounded-xl text-xs font-semibold transition-all",
              isLent
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
            )}>
            {isLent ? "✓ Received" : "↑ Pay Back"}
          </button>
        )}

        {debt.payments.length > 0 && (
          <>
            <button onClick={() => setExpanded(v => !v)}
              className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted/40 rounded-xl px-3 py-2">
              <span>{debt.payments.length} payment{debt.payments.length !== 1 ? "s" : ""}</span>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {expanded && (
              <div className="space-y-1.5 border-t border-border/50 pt-3">
                {debt.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="truncate">{p.note || "Payment"}</span>
                      <span className="text-muted-foreground/50 shrink-0">
                        {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <span className="font-semibold text-foreground shrink-0 ml-2">{fmt(p.amount)}</span>
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
  const { fmt } = useAmountFormatter();
  const active    = debts.filter(d => d.status !== "SETTLED");
  const lentAmt   = active.filter(d => d.type === "LENT")    .reduce((s, d) => s + d.amountRemaining, 0);
  const borrowAmt = active.filter(d => d.type === "BORROWED").reduce((s, d) => s + d.amountRemaining, 0);
  const net       = lentAmt - borrowAmt;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <PremiumIcon icon={ArrowUpRight} tone="emerald" size="xs" />
          <p className="text-xs text-muted-foreground">You&apos;re owed</p>
        </div>
        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(lentAmt)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {active.filter(d => d.type === "LENT").length} active
        </p>
      </div>
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <PremiumIcon icon={ArrowDownLeft} tone="red" size="xs" />
          <p className="text-xs text-muted-foreground">You owe</p>
        </div>
        <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">{fmt(borrowAmt)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {active.filter(d => d.type === "BORROWED").length} active
        </p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <PremiumIcon icon={net >= 0 ? TrendingUp : TrendingDown} tone={(net >= 0 ? "emerald" : "red") as IconTone} size="xs" />
          <p className="text-xs text-muted-foreground">Net</p>
        </div>
        <p className={cn("text-lg font-bold tabular-nums", net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
          {net >= 0 ? "+" : ""}{fmt(Math.abs(net))}
        </p>
        <p className={cn("text-xs mt-0.5", net >= 0 ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-rose-600/70 dark:text-rose-400/70")}>
          {net >= 0 ? "in your favour" : "you owe more"}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "ALL" | "LENT" | "BORROWED";

// Matches this page's own FAB action colors ("I Lent"=emerald, "I Borrowed"=rose) — same
// per-type solid-fill template as Investments/Accounts/Transactions.
const TAB_ACTIVE_BG: Record<Tab, string> = {
  ALL:      "bg-slate-600",
  LENT:     "bg-emerald-600",
  BORROWED: "bg-rose-600",
};
type Modal = null
  | { mode: "create"; defaultType: DebtType }
  | { mode: "edit";   debt: DebtRecord };

export default function DebtsPage() {
  const { fmt } = useAmountFormatter();
  const [tab,       setTab]       = useState<Tab>("ALL");
  const [modal,     setModal]     = useState<Modal>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const { data: debts = [], isLoading }   = useDebts();
  const { data: accountsData }            = useAccounts();
  const accounts = (accountsData ?? []).filter(a => !a.archived && a.accountType !== "CREDIT_CARD");

  const { mutate: createDebt, isPending: creating } = useCreateDebt();
  const { mutate: updateDebt, isPending: updating } = useUpdateDebt();
  const { mutate: recordPay,  isPending: paying    } = useRecordDebtPayment();
  const { mutate: deleteDebt, isPending: deleting }  = useDeleteDebt();

  const filtered = tab === "ALL" ? debts : debts.filter(d => d.type === tab);
  const payDebt  = debts.find(d => d.id === paymentId);
  const delDebt  = debts.find(d => d.id === deleteId);

  const tabs: { id: Tab; label: string; icon: LucideIcon; count: number }[] = [
    { id: "ALL",      label: "All",      icon: Wallet,        count: debts.length },
    { id: "LENT",     label: "Lent",     icon: ArrowUpRight,  count: debts.filter(d => d.type === "LENT").length },
    { id: "BORROWED", label: "Borrowed", icon: ArrowDownLeft, count: debts.filter(d => d.type === "BORROWED").length },
  ];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Debt Tracker" subtitle="Track money you've lent or borrowed, and keep tabs on payoff progress" />
      <PageWrapper>

        {debts.length > 0 && <Summary debts={debts} />}

        {/* Tabs — same template as the Investments page's tab bar. */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 overflow-x-auto max-w-full" style={{ scrollbarWidth: "none" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0",
                  tab === t.id ? cn(TAB_ACTIVE_BG[t.id], "text-white") : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {t.id !== "ALL" && t.count > 0 && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-bold",
                    tab === t.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-card border border-border rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GlossyBadge hex={TONE_HEX.indigo} size="lg" className="mb-4">
              <Handshake className="w-7 h-7 text-white" strokeWidth={2.25} />
            </GlossyBadge>
            <p className="text-sm font-semibold text-foreground">No debts here</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {tab === "LENT" ? "You haven't lent any money yet." :
               tab === "BORROWED" ? "You haven't borrowed any money yet." :
               "Track money lent to others or borrowed from someone."}
            </p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal({ mode: "create", defaultType: "LENT" })}
                className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all">
                <ArrowUpRight className="w-4 h-4" /> I Lent
              </button>
              <button onClick={() => setModal({ mode: "create", defaultType: "BORROWED" })}
                className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all">
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
          onDelete={modal.mode === "edit" ? () => { setDeleteId(modal.debt.id); setModal(null); } : undefined}
          onSave={v => {
            if (modal.mode === "edit") {
              updateDebt({
                id: modal.debt.id,
                payload: {
                  contactName: v.contactName, contactPhone: v.contactPhone || undefined,
                  amount: Number(v.amount), description: v.description || undefined,
                  debtDate: v.debtDate, dueDate: v.dueDate || undefined,
                },
              }, { onSuccess: () => setModal(null) });
            } else {
              createDebt({
                type: v.type!, contactName: v.contactName, contactPhone: v.contactPhone || undefined,
                amount: Number(v.amount), description: v.description || undefined,
                debtDate: v.debtDate, dueDate: v.dueDate || undefined, accountId: v.accountId,
              }, { onSuccess: () => setModal(null) });
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
        <TransactionModalOverlay onDismiss={() => setDeleteId(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-5 sm:p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Delete debt record?</p>
              <p className="text-xs text-muted-foreground mt-1">
                {delDebt.type === "LENT" ? "Lent" : "Borrowed"} {fmt(delDebt.amount)} {delDebt.type === "LENT" ? "to" : "from"} <strong className="text-foreground">{delDebt.contactName}</strong>
              </p>
              {delDebt.accountName && (
                <p className="text-xs text-muted-foreground/80 mt-1">
                  Account balance will be fully reversed, including any payments recorded.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" className="flex-1" loading={deleting}
                onClick={() => deleteDebt(delDebt.id, { onSuccess: () => setDeleteId(null) })}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </TransactionModalOverlay>
      )}

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={[
        { icon: ArrowUpRight,   label: "I Lent",     color: "emerald", onClick: () => setModal({ mode: "create", defaultType: "LENT" }) },
        { icon: ArrowDownLeft,  label: "I Borrowed",  color: "rose",    onClick: () => setModal({ mode: "create", defaultType: "BORROWED" }) },
      ]} />
    </div>
  );
}
