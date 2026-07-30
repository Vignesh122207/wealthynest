"use client";

import {useEffect, useRef, useState} from "react";
import {CalendarDays, Check, ChevronDown, Plus, Power, RefreshCw} from "lucide-react";
import {cn, formatCurrency} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {FloatingActionButton} from "@/components/shared/FloatingActionButton";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {BigAmountInput} from "@/components/transactions/BigAmountInput";
import {AccountPicker} from "@/components/transactions/AccountPicker";
import {CategoryPicker} from "@/components/transactions/CategoryPicker";
import {DropdownPanel} from "@/components/transactions/DropdownPanel";
import {INCOME_SOURCES} from "@/lib/constants";
import {INCOME_ICON_MAP} from "@/lib/categoryMeta";
import {
    useCreateRecurringIncome,
    useDeleteRecurringIncome,
    useRecurringIncome,
    useToggleRecurringIncome,
    useUpdateRecurringIncome,
} from "@/features/recurringIncome/hooks/useRecurringIncome";
import type {RecurringIncome} from "@/features/recurringIncome/types/recurringIncome.types";
import {useAccounts} from "@/features/accounts/hooks/useAccounts";

// ─── Day helpers ──────────────────────────────────────────────────────────────

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function dayLabel(day: number) {
  if (day === 0) return "Last working day of every month";
  return `${ordinal(day)} of every month`;
}

function lastCreditedLabel(month?: number) {
  if (!month) return "Not yet run";
  const y = Math.floor(month / 100);
  const m = month % 100;
  const d = new Date(y, m - 1, 1);
  return "Last run: " + d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

// ─── Rule Form Modal ──────────────────────────────────────────────────────────

function RuleFormModal({
  initial,
  accounts,
  onSave,
  onClose,
  onDelete,
  saving,
}: {
  initial?: Partial<RecurringIncome>;
  accounts: { id: string; name: string; accountType: string; bankName?: string; currentBalance: number; primary?: boolean }[];
  onSave: (v: { accountId: string; source: string; amount: number; description: string; dayOfMonth: number }) => void;
  onClose: () => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [accountId,   setAccountId]   = useState(initial?.accountId   ?? accounts[0]?.id ?? "");
  const [source,      setSource]      = useState(initial?.source      ?? "SALARY");
  const [amount,      setAmount]      = useState(initial?.amount?.toString() ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [day,         setDay]         = useState(initial?.dayOfMonth?.toString() ?? "0");
  const [dayOpen, setDayOpen] = useState(false);
  const dayTriggerRef = useRef<HTMLButtonElement>(null);

  const isEdit = !!initial?.id;

  // accounts can still be loading (empty) the instant this modal mounts — the useState default
  // above only evaluates once, so if useAccounts() resolves after mount the picker would
  // otherwise be stuck on no default forever. Sync once accounts arrive, but only for a fresh
  // rule (edits already have their own initial.accountId) and only if nothing's been picked yet.
  useEffect(() => {
    if (!isEdit && !accountId && accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accounts, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid  = accountId && source && Number(amount) > 0 && Number(day) >= 0 && Number(day) <= 31;
  const sourceMeta = INCOME_ICON_MAP[source] ?? INCOME_ICON_MAP.OTHER;
  // Same split as IncomeForm — recurring income credits can't land on a credit card.
  const depositCash = accounts.filter(a => a.accountType === "CASH_WALLET");
  const depositBank = accounts.filter(a => a.accountType === "BANK_ACCOUNT");
  const sourceOptions = INCOME_SOURCES.map(s => ({ value: s.value, label: s.label }));
  const sourceIconFor = (opt: { value: string; label: string }) => INCOME_ICON_MAP[opt.value] ?? INCOME_ICON_MAP.OTHER;

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
        <div className="h-1.5 bg-gradient-to-r from-indigo-400 to-violet-500" />
        <div className="p-5">
          <FormModalHeader icon={sourceMeta.icon} hex={sourceMeta.color}
            title={isEdit ? "Edit Rule" : "Add Recurring Income"} onDelete={onDelete} onClose={onClose} />
          <p className="text-xs text-muted-foreground -mt-3 mb-4">Auto-credits your income every month</p>

          <div className="space-y-4">
            <BigAmountInput label="Monthly Amount" colorClass="text-indigo-500 dark:text-indigo-400"
              testId="recurring-income-amount-input"
              inputProps={{
                value: amount,
                onChange: e => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")),
              }} />

            <div className="space-y-4">
              <AccountPicker label="Credit to Account" testId="recurring-income-account-picker"
                cashAccounts={depositCash} bankAccounts={depositBank}
                value={accountId} onChange={setAccountId} />

              <CategoryPicker label="Income Source" placeholder="Select source"
                categories={sourceOptions} value={source} onChange={setSource} iconFor={sourceIconFor} />

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Credit Day</label>
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
                            d > 28 && String(d) !== day && "text-muted-foreground/80")}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </DropdownPanel>
                {Number(day) === 0 && (
                  <p className="text-[10px] text-indigo-500/70 mt-1">e.g. if month ends Saturday, credits on Friday</p>
                )}
                {Number(day) > 28 && Number(day) !== 0 && (
                  <p className="text-[10px] text-amber-500/80 mt-1">
                    Credits on last day of months shorter than {day} days
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Note <span className="text-muted-foreground/80">(optional)</span>
              </label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Company salary" data-testid="recurring-income-description-input"
                className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
            </div>

            {/* Preview */}
            {valid && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-xs text-indigo-500 dark:text-indigo-400">
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>{formatCurrency(Number(amount))}</strong> will be auto-credited to{" "}
                  <strong>{accounts.find(a => a.id === accountId)?.name}</strong> on the{" "}
                  <strong>{dayLabel(Number(day))}</strong>
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => valid && onSave({ accountId, source, amount: Number(amount), description, dayOfMonth: Number(day) })}
                type="button" disabled={saving || !valid} data-testid="recurring-income-form-submit"
                className="flex-1 h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#c2703d] to-[#27272a] hover:from-[#d98a52] hover:to-[#3f3f46] text-white shadow-lg shadow-[#c2703d]/25 transition-all disabled:opacity-60 disabled:shadow-none flex items-center justify-center gap-1.5">
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
  rule,
  onEdit,
  onToggle,
  toggling,
}: {
  rule:     RecurringIncome;
  onEdit:   () => void;
  onToggle: () => void;
  toggling: boolean;
}) {
  const { fmt } = useAmountFormatter();
  const meta = INCOME_ICON_MAP[rule.source] ?? INCOME_ICON_MAP.OTHER;

  return (
    <div onClick={onEdit} data-testid="recurring-income-rule-card"
      className={cn(
      "relative bg-card border rounded-2xl p-4 transition-all cursor-pointer hover:border-indigo-500/40 hover:shadow-sm hover:-translate-y-0.5 duration-200",
      rule.active ? "border-border" : "border-border opacity-60"
    )}>
      {/* Real, separately-focusable control for the same action the card's plain onClick above
          already does — a role="button" here would nest the toggle button below inside another
          interactive widget (axe's nested-interactive rule), so the card itself stays a
          non-widget div and this sr-only-until-focused button is the keyboard/screen-reader path
          to Edit instead (see AccountCard.tsx's identical fix). */}
      <button type="button" onClick={onEdit}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-20 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-xs focus:font-medium">
        Edit {INCOME_SOURCES.find(s => s.value === rule.source)?.label ?? rule.source} recurring income
      </button>
      <div className="flex items-start gap-3">
        <PremiumIcon icon={meta.icon} hex={meta.color} size="md" className="w-10 h-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">
              {INCOME_SOURCES.find(s => s.value === rule.source)?.label ?? rule.source}
            </p>
            <span className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full",
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
              {dayLabel(rule.dayOfMonth)} → {rule.accountName}
            </span>
            <span className="text-muted-foreground/80">{lastCreditedLabel(rule.lastCreditedMonth)}</span>
          </div>
          {rule.description && (
            <p className="text-xs text-muted-foreground/80 mt-1 truncate">{rule.description}</p>
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

type ModalState = null | "create" | RecurringIncome;

export function IncomeTab() {
  const { fmt } = useAmountFormatter();
  const [modal,    setModal]    = useState<ModalState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rules   = [], isLoading }           = useRecurringIncome();
  const { data: accountsData }                      = useAccounts();
  const accounts = (accountsData ?? []).filter(a => !a.archived);
  const { mutate: createRule, isPending: creating } = useCreateRecurringIncome();
  const { mutate: updateRule, isPending: updating } = useUpdateRecurringIncome();
  const { mutate: toggleRule, isPending: toggling } = useToggleRecurringIncome();
  const { mutate: deleteRule, isPending: deleting } = useDeleteRecurringIncome();

  const deletingRule = rules.find(r => r.id === deleteId);
  const isEdit       = modal !== null && modal !== "create";
  const isSaving     = isEdit ? updating : creating;

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Set up monthly auto-credits for salary, freelance, or any recurring income.
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
            <RefreshCw className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-foreground">No recurring income rules</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Add a rule to auto-credit your salary or any monthly income directly to your account.
          </p>
          <button onClick={() => setModal("create")}
            className="mt-4 flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-emerald-700 hover:bg-emerald-600 text-white transition-all">
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
                { id: (modal as RecurringIncome).id, payload: v },
                { onSuccess: () => setModal(null) }
              );
            } else {
              createRule(v, { onSuccess: () => setModal(null) });
            }
          }}
          onDelete={isEdit ? () => { setDeleteId((modal as RecurringIncome).id); setModal(null); } : undefined}
        />
      )}

      {deleteId && deletingRule && (
        <ConfirmDialog open title="Delete this rule?"
          description={`The auto-credit for ${INCOME_SOURCES.find(s => s.value === deletingRule.source)?.label} (${fmt(deletingRule.amount)}/month) will stop. Past income entries won't be removed.`}
          confirmLabel={deleting ? "Deleting…" : "Delete Rule"} danger
          onConfirm={() => deleteRule(deleteId, { onSuccess: () => setDeleteId(null) })}
          onCancel={() => setDeleteId(null)} />
      )}

      <FloatingActionButton actions={[
        { icon: RefreshCw, label: "Add Recurring Income", color: "indigo", onClick: () => setModal("create"), testId: "fab-add-recurring-income" },
      ]} />
    </>
  );
}
