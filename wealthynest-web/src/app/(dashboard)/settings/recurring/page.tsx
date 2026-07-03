"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Plus, Pencil, Trash2, X, Check, Power, CalendarDays, RefreshCw } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { INCOME_SOURCES, INCOME_SOURCE_ICONS, INCOME_SOURCE_COLORS } from "@/lib/constants";
import {
  useRecurringIncome,
  useCreateRecurringIncome,
  useUpdateRecurringIncome,
  useToggleRecurringIncome,
  useDeleteRecurringIncome,
} from "@/features/recurringIncome/hooks/useRecurringIncome";
import type { RecurringIncome } from "@/features/recurringIncome/types/recurringIncome.types";
import { useAccounts } from "@/features/accounts/hooks/useAccounts";

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

const DAY_OPTIONS = [
  { value: "0",  label: "Last Working Day (Mon–Fri nearest month-end)" },
  ...Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: i + 1 <= 28
      ? `${ordinal(i + 1)} of month`
      : `${ordinal(i + 1)} of month (may skip short months)`,
  })),
];

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
  saving,
}: {
  initial?: Partial<RecurringIncome>;
  accounts: { id: string; name: string; accountType: string }[];
  onSave: (v: { accountId: string; source: string; amount: number; description: string; dayOfMonth: number }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [accountId,   setAccountId]   = useState(initial?.accountId   ?? accounts[0]?.id ?? "");
  const [source,      setSource]      = useState(initial?.source      ?? "SALARY");
  const [amount,      setAmount]      = useState(initial?.amount?.toString() ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [day,         setDay]         = useState(initial?.dayOfMonth?.toString() ?? "0");

  const isEdit = !!initial?.id;
  const valid  = accountId && source && Number(amount) > 0 && Number(day) >= 0 && Number(day) <= 31;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{isEdit ? "Edit Rule" : "Add Recurring Income"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Auto-credits your income every month</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Credit to Account</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground outline-none focus:border-indigo-500 transition-all">
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Income Source</label>
            <select value={source} onChange={e => setSource(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground outline-none focus:border-indigo-500 transition-all">
              {INCOME_SOURCES.map(s => (
                <option key={s.value} value={s.value}>{INCOME_SOURCE_ICONS[s.value]} {s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Monthly Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/60">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                onFocus={e => e.target.select()} placeholder="e.g. 85000"
                className="w-full h-10 pl-6 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Credit Day</label>
            <select value={day} onChange={e => setDay(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground outline-none focus:border-indigo-500 transition-all">
              {DAY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
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
            Note <span className="text-muted-foreground/40">(optional)</span>
          </label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Company salary"
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

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} type="button"
            className="h-10 px-5 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
            Cancel
          </button>
          <button
            onClick={() => valid && onSave({ accountId, source, amount: Number(amount), description, dayOfMonth: Number(day) })}
            type="button" disabled={saving || !valid}
            className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60 flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  toggling,
}: {
  rule:     RecurringIncome;
  onEdit:   () => void;
  onDelete: () => void;
  onToggle: () => void;
  toggling: boolean;
}) {
  const color = INCOME_SOURCE_COLORS[rule.source] ?? "#6366f1";
  const icon  = INCOME_SOURCE_ICONS[rule.source]  ?? "💰";

  return (
    <div className={cn(
      "bg-card border rounded-2xl p-4 transition-all",
      rule.active ? "border-border" : "border-border opacity-60"
    )}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: color + "18" }}>
          {icon}
        </div>
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
            {formatCurrency(rule.amount)}
            <span className="text-xs font-normal text-muted-foreground ml-1">/ month</span>
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {dayLabel(rule.dayOfMonth)} → {rule.accountName}
            </span>
            <span className="text-muted-foreground/50">{lastCreditedLabel(rule.lastCreditedMonth)}</span>
          </div>
          {rule.description && (
            <p className="text-xs text-muted-foreground/60 mt-1 truncate">{rule.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
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
          <button onClick={onEdit}
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10 flex items-center justify-center transition-all">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete}
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ModalState = null | "create" | RecurringIncome;

export default function RecurringIncomePage() {
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
    <div className="flex flex-col flex-1">
      <Header title="Recurring Income" />
      <PageWrapper>

        {/* Header row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Set up monthly auto-credits for salary, freelance, or any recurring income.
          </p>
          <button onClick={() => setModal("create")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all shrink-0">
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        </div>

        {/* Rules list */}
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
                onDelete={() => setDeleteId(rule.id)}
                onToggle={() => toggleRule(rule.id)}
              />
            ))}
          </div>
        )}
      </PageWrapper>

      {/* Rule form modal */}
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
        />
      )}

      {/* Delete confirm */}
      {deleteId && deletingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Delete this rule?</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  The auto-credit for <strong>{INCOME_SOURCES.find(s => s.value === deletingRule.source)?.label}</strong> ({formatCurrency(deletingRule.amount)}/month) will stop. Past income entries won't be removed.
                </p>
              </div>
              <button onClick={() => setDeleteId(null)}
                className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 h-10 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                Cancel
              </button>
              <button
                onClick={() => deleteRule(deleteId, { onSuccess: () => setDeleteId(null) })}
                disabled={deleting}
                className="flex-1 h-10 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-60">
                {deleting ? "Deleting…" : "Delete Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
