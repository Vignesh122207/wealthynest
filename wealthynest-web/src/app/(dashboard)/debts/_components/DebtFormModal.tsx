"use client";

import {useState} from "react";
import {ArrowDownLeft, ArrowUpRight, Check, Handshake, Phone} from "lucide-react";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {Button} from "@/components/ui/Button";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {AccountPicker} from "@/components/transactions/AccountPicker";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {BigAmountInput} from "@/components/transactions/BigAmountInput";
import {cn} from "@/lib/utils";
import {todayLocalISO} from "@/lib/date";
import {type DebtFormValues, debtSchema} from "@/features/debts/schemas/debt.schema";
import type {DebtRecord, DebtType} from "@/features/debts/types/debt.types";

// ── Debt Form Modal ───────────────────────────────────────────────────────────

export function DebtFormModal({ initial, defaultType, accounts, onSave, onDelete, onClose, saving }: {
  initial?:     DebtRecord;
  defaultType?: DebtType;
  accounts:     { id: string; name: string; bankName?: string; currentBalance: number; primary?: boolean; accountType: string }[];
  onSave:       (v: DebtFormValues & { type?: DebtType; accountId?: string }) => void;
  onDelete?:    () => void;
  onClose:      () => void;
  saving:       boolean;
}) {
  const today = todayLocalISO();
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
      amount:       initial?.amount ?? undefined,
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
              <button type="button" data-testid="debt-type-lent" onClick={() => setType("LENT")}
                className={cn("flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium transition-all border",
                  type === "LENT" ? "bg-emerald-700 border-emerald-500 text-white" : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                <ArrowUpRight className="w-3.5 h-3.5" /> I Lent
              </button>
              <button type="button" data-testid="debt-type-borrowed" onClick={() => setType("BORROWED")}
                className={cn("flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium transition-all border",
                  type === "BORROWED" ? "bg-rose-600 border-rose-500 text-white" : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                <ArrowDownLeft className="w-3.5 h-3.5" /> I Borrowed
              </button>
            </div>
          )}

          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <BigAmountInput colorClass={isLent ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}
              testId="debt-amount-input"
              error={form.formState.errors.amount?.message} inputProps={form.register("amount")} />

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {isLent ? "Who did you lend to?" : "Who did you borrow from?"}
              </label>
              <input placeholder="Name" data-testid="debt-contact-name-input"
                className={cn("w-full h-11 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none transition-all",
                  isLent ? "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40" : "focus:border-red-500 focus:ring-2 focus:ring-red-500/40")}
                {...form.register("contactName")} />
              {form.formState.errors.contactName && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.contactName.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Controller control={form.control} name="debtDate" render={({ field, fieldState }) => (
                <FormDatePicker label={isLent ? "Date Lent" : "Date Borrowed"} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} placeholder="Pick date" testId="debt-date-input" />
              )} />
              <Controller control={form.control} name="dueDate" render={({ field, fieldState }) => (
                <FormDatePicker label="Due Date (optional)" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} placeholder="Pick date" testId="debt-due-date-input" />
              )} />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone <span className="text-muted-foreground/80">(optional)</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <input placeholder="Number" data-testid="debt-contact-phone-input"
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
                  value={accountId} onChange={setAccountId} testId="debt-account-picker" />
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
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note <span className="text-muted-foreground/80">(optional)</span></label>
              <input placeholder="What's it for?" data-testid="debt-note-input"
                className={cn("w-full h-11 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none transition-all",
                  isLent ? "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40" : "focus:border-red-500 focus:ring-2 focus:ring-red-500/40")}
                {...form.register("description")} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" data-testid="debt-form-submit" variant="gradient" loading={saving}
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
