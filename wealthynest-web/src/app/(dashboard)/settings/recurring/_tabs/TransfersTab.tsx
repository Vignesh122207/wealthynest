"use client";

import { useRef, useState } from "react";
import { ChevronDown, Plus, Check, Power, CalendarDays, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { FormModalHeader } from "@/components/transactions/FormModalHeader";
import { TransactionModalOverlay } from "@/components/transactions/TransactionModalOverlay";
import { BigAmountInput } from "@/components/transactions/BigAmountInput";
import { AccountPicker } from "@/components/transactions/AccountPicker";
import { DropdownPanel } from "@/components/transactions/DropdownPanel";
import { useAccounts } from "@/features/accounts/hooks/useAccounts";
import {
  useRecurringTransfer,
  useCreateRecurringTransfer,
  useUpdateRecurringTransfer,
  useToggleRecurringTransfer,
  useDeleteRecurringTransfer,
} from "@/features/recurringTransfer/hooks/useRecurringTransfer";
import type { RecurringTransfer } from "@/features/recurringTransfer/types/recurringTransfer.types";
import type { WalletAccount } from "@/features/accounts/types/account.types";

// ─── Day helpers (same semantics as Recurring Income's Credit Day) ─────────────

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function dayLabel(day: number) {
  if (day === 0) return "Last working day of every month";
  return `${ordinal(day)} of every month`;
}

function byType(list: WalletAccount[], type: string) {
  return list.filter(a => a.accountType === type);
}

// ─── Rule Form Modal ────────────────────────────────────────────────────────

function RuleFormModal({
  initial, accounts, onSave, onClose, onDelete, saving,
}: {
  initial?: Partial<RecurringTransfer>;
  accounts: WalletAccount[];
  onSave: (v: { fromAccountId: string; toAccountId: string; amount: number; description: string; dayOfMonth: number }) => void;
  onClose: () => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [fromAccountId, setFromAccountId] = useState(initial?.fromAccountId ?? accounts[0]?.id ?? "");
  const [toAccountId,   setToAccountId]   = useState(initial?.toAccountId   ?? "");
  const [amount,        setAmount]        = useState(initial?.amount?.toString() ?? "");
  const [description,   setDescription]   = useState(initial?.description ?? "");
  const [day,           setDay]           = useState(initial?.dayOfMonth?.toString() ?? "0");
  const [dayOpen, setDayOpen] = useState(false);
  const dayTriggerRef = useRef<HTMLButtonElement>(null);

  const isEdit = !!initial?.id;
  const valid  = fromAccountId && toAccountId && fromAccountId !== toAccountId
    && Number(amount) > 0 && Number(day) >= 0 && Number(day) <= 31;

  const fromChoices = accounts.filter(a => a.id !== toAccountId);
  const toChoices   = accounts.filter(a => a.id !== fromAccountId);

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
        <div className="h-1.5 bg-gradient-to-r from-indigo-400 to-violet-500" />
        <div className="p-5">
          <FormModalHeader icon={ArrowLeftRight} tone="indigo"
            title={isEdit ? "Edit Rule" : "Add Recurring Transfer"} onDelete={onDelete} onClose={onClose} />
          <p className="text-xs text-muted-foreground -mt-3 mb-4">Auto-moves money between your accounts every month</p>

          <div className="space-y-4">
            <BigAmountInput label="Monthly Amount" colorClass="text-indigo-500 dark:text-indigo-400"
              inputProps={{
                value: amount,
                onChange: e => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")),
              }} />

            <AccountPicker label="From Account"
              cashAccounts={byType(fromChoices, "CASH_WALLET")}
              bankAccounts={byType(fromChoices, "BANK_ACCOUNT")}
              creditAccounts={byType(fromChoices, "CREDIT_CARD")}
              emergencyFundAccounts={byType(fromChoices, "EMERGENCY_FUND")}
              investmentAccounts={byType(fromChoices, "INVESTMENT")}
              value={fromAccountId} onChange={setFromAccountId} />

            <AccountPicker label="To Account"
              cashAccounts={byType(toChoices, "CASH_WALLET")}
              bankAccounts={byType(toChoices, "BANK_ACCOUNT")}
              creditAccounts={byType(toChoices, "CREDIT_CARD")}
              emergencyFundAccounts={byType(toChoices, "EMERGENCY_FUND")}
              investmentAccounts={byType(toChoices, "INVESTMENT")}
              value={toAccountId} onChange={setToAccountId} placeholder="Select destination account" />

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Transfer Day</label>
              <button type="button" ref={dayTriggerRef} onClick={() => setDayOpen(v => !v)}
                className="w-full h-11 px-3 rounded-xl border flex items-center gap-2.5 text-sm text-left transition-all bg-background text-foreground border-border hover:border-indigo-500/50">
                <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{dayLabel(Number(day))}</span>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform", dayOpen && "rotate-180")} />
              </button>
              <DropdownPanel anchorRef={dayTriggerRef} open={dayOpen} onClose={() => setDayOpen(false)}>
                <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
                  <button type="button" onClick={() => { setDay("0"); setDayOpen(false); }}
                    className={cn("w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors mb-2",
                      day === "0" ? "bg-indigo-500 text-white" : "bg-muted/60 text-foreground hover:bg-muted")}>
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    Last working day of every month
                  </button>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <button key={d} type="button" onClick={() => { setDay(String(d)); setDayOpen(false); }}
                        className={cn("aspect-square rounded-lg text-xs font-medium tabular-nums transition-colors",
                          String(d) === day ? "bg-indigo-500 text-white" : "text-foreground hover:bg-muted",
                          d > 28 && String(d) !== day && "text-muted-foreground/50")}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </DropdownPanel>
              {Number(day) === 0 && (
                <p className="text-[10px] text-indigo-500/70 mt-1">e.g. if month ends Saturday, transfers on Friday</p>
              )}
              {Number(day) > 28 && Number(day) !== 0 && (
                <p className="text-[10px] text-amber-500/80 mt-1">
                  Transfers on last day of months shorter than {day} days
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Note <span className="text-muted-foreground/40">(optional)</span>
              </label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Move to savings"
                className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => valid && onSave({ fromAccountId, toAccountId, amount: Number(amount), description, dayOfMonth: Number(day) })}
                type="button" disabled={saving || !valid}
                className="flex-1 h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-60 disabled:shadow-none flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Rule"}
              </button>
              <button onClick={onClose} type="button"
                className="h-11 px-5 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </TransactionModalOverlay>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule, onEdit, onToggle, toggling,
}: {
  rule:     RecurringTransfer;
  onEdit:   () => void;
  onToggle: () => void;
  toggling: boolean;
}) {
  const { fmt } = useAmountFormatter();

  return (
    <div onClick={onEdit} role="button" tabIndex={0}
      aria-label={`Edit ${rule.fromAccountName} to ${rule.toAccountName} recurring transfer`}
      className={cn(
      "bg-card border rounded-2xl p-4 transition-all cursor-pointer hover:border-indigo-500/40 hover:shadow-sm hover:-translate-y-0.5 duration-200",
      rule.active ? "border-border" : "border-border opacity-60"
    )}>
      <div className="flex items-start gap-3">
        <PremiumIcon icon={ArrowLeftRight} hex="#6366f1" size="md" className="w-10 h-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">
              {rule.fromAccountName} → {rule.toAccountName}
            </p>
            <span className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0",
              rule.active
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            )}>
              {rule.active ? "Active" : "Paused"}
            </span>
          </div>
          <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">
            {fmt(rule.amount)}
            <span className="text-xs font-normal text-muted-foreground ml-1">/ month</span>
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {dayLabel(rule.dayOfMonth)}
            </span>
          </div>
          {rule.description && (
            <p className="text-xs text-muted-foreground/60 mt-1 truncate">{rule.description}</p>
          )}
        </div>

        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onToggle} disabled={toggling}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              rule.active
                ? "text-emerald-500 hover:bg-emerald-500/10"
                : "text-muted-foreground hover:bg-muted"
            )}
            title={rule.active ? "Pause" : "Resume"}>
            <Power className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

type ModalState = null | "create" | RecurringTransfer;

export function TransfersTab() {
  const { fmt } = useAmountFormatter();
  const [modal,    setModal]    = useState<ModalState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rules   = [], isLoading }           = useRecurringTransfer();
  const { data: accountsData }                      = useAccounts();
  const accounts = (accountsData ?? []).filter(a => !a.archived);
  const { mutate: createRule, isPending: creating } = useCreateRecurringTransfer();
  const { mutate: updateRule, isPending: updating } = useUpdateRecurringTransfer();
  const { mutate: toggleRule, isPending: toggling } = useToggleRecurringTransfer();
  const { mutate: deleteRule, isPending: deleting } = useDeleteRecurringTransfer();

  const deletingRule = rules.find(r => r.id === deleteId);
  const isEdit       = modal !== null && modal !== "create";
  const isSaving     = isEdit ? updating : creating;

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Set up a rule to move a fixed amount from one account to another every month.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 bg-card border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
            <ArrowLeftRight className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-foreground">No recurring transfers</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Add a rule to auto-move money — like sweeping salary overflow into savings every month.
          </p>
          <button onClick={() => setModal("create")}
            className="mt-4 flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all">
            <Plus className="w-4 h-4" /> Add First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              toggling={toggling}
              onEdit={() => setModal(rule)}
              onToggle={() => toggleRule(rule.id)}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <RuleFormModal
          initial={modal === "create" ? undefined : modal}
          accounts={accounts}
          saving={isSaving}
          onClose={() => setModal(null)}
          onSave={v => {
            if (isEdit) {
              updateRule(
                { id: (modal as RecurringTransfer).id, payload: v },
                { onSuccess: () => setModal(null) }
              );
            } else {
              createRule(v, { onSuccess: () => setModal(null) });
            }
          }}
          onDelete={isEdit ? () => { setDeleteId((modal as RecurringTransfer).id); setModal(null); } : undefined}
        />
      )}

      {deleteId && deletingRule && (
        <ConfirmDialog open title="Delete this rule?"
          description={`The auto-transfer from ${deletingRule.fromAccountName} to ${deletingRule.toAccountName} (${fmt(deletingRule.amount)}/month) will stop.`}
          confirmLabel={deleting ? "Deleting…" : "Delete Rule"} danger
          onConfirm={() => deleteRule(deleteId, { onSuccess: () => setDeleteId(null) })}
          onCancel={() => setDeleteId(null)} />
      )}

      <FloatingActionButton actions={[
        { icon: ArrowLeftRight, label: "Add Recurring Transfer", color: "indigo", onClick: () => setModal("create") },
      ]} />
    </>
  );
}
