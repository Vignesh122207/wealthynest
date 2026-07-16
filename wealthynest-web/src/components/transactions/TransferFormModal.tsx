"use client";

import { ArrowLeftRight, Check } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormInput } from "@/components/forms/FormInput";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import type { AccountTransfer } from "@/features/accounts/types/account.types";
import { AccountPicker } from "./AccountPicker";
import { BigAmountInput } from "./BigAmountInput";
import { FormModalHeader } from "./FormModalHeader";

// ─── Transfer Form ────────────────────────────────────────────────────────────

export const transferFormSchema = z.object({
  fromAccountId: z.string().min(1, "Select source account"),
  toAccountId:   z.string().min(1, "Select destination account"),
  amount:        z.coerce.number().positive("Amount must be positive"),
  transferDate:  z.string().min(1, "Date is required"),
  description:   z.string().optional(),
});
export type TransferFormValues = z.infer<typeof transferFormSchema>;

export function TransferFormModal({ onSubmit, onCancel, onDelete, isPending, accounts, editTransferRef, isEdit, title, submitLabel, defaultFromAccountId, defaultToAccountId }: {
  onSubmit:         (v: TransferFormValues) => void;
  onCancel:         () => void;
  onDelete?:        () => void;
  isPending:        boolean;
  accounts:         { id: string; name: string; accountType: string; bankName?: string; currentBalance: number; primary?: boolean }[];
  editTransferRef?: AccountTransfer;
  isEdit?:          boolean;
  /** Overrides the default "New Transfer"/"Edit Transfer" heading — e.g. "Pay Credit Card Bill"
   * when opened from a card's dedicated pay-bill action. */
  title?:                string;
  submitLabel?:           string;
  defaultFromAccountId?: string;
  defaultToAccountId?:   string;
}) {
  const today = new Date().toISOString().split("T")[0];
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      fromAccountId: editTransferRef?.fromAccountId ?? defaultFromAccountId ?? "",
      toAccountId:   editTransferRef?.toAccountId   ?? defaultToAccountId   ?? "",
      amount:        editTransferRef?.amount,
      transferDate:  editTransferRef?.transferDate   ?? today,
      description:   editTransferRef?.description   ?? "",
    },
  });
  const fromId = form.watch("fromAccountId");
  const toId   = form.watch("toAccountId");
  const byType = (list: typeof accounts, type: string) => list.filter(a => a.accountType === type);
  const fromChoices = accounts.filter(a => a.id !== toId);
  const toChoices   = accounts.filter(a => a.id !== fromId);

  // Instant "insufficient balance" feedback for the source account — same rule the server
  // enforces authoritatively. Credit cards/loans are skipped: their balance is a debt, not
  // spendable funds, so transferring "from" one isn't bounded by zero the same way.
  const originalAmount = editTransferRef?.amount ?? 0;
  const handleValidatedSubmit = (values: TransferFormValues) => {
    const from = accounts.find(a => a.id === values.fromAccountId);
    if (from && from.accountType !== "CREDIT_CARD" && from.accountType !== "LOAN") {
      const balanceAfter = from.currentBalance + originalAmount - Number(values.amount);
      if (balanceAfter < 0) {
        form.setError("fromAccountId", { message: `Insufficient balance in ${from.name}.` });
        return;
      }
    }
    onSubmit(values);
  };

  return (
    <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
      <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-blue-600" />
      <div className="p-5">
        <FormModalHeader icon={ArrowLeftRight} tone="indigo"
          title={title ?? (isEdit ? "Edit Transfer" : "New Transfer")} onDelete={onDelete} onClose={onCancel} />
        <form onSubmit={form.handleSubmit(handleValidatedSubmit)} className="space-y-4">
          <BigAmountInput colorClass="text-indigo-500 dark:text-indigo-400"
            error={form.formState.errors.amount?.message} inputProps={form.register("amount")} />

          {isEdit && editTransferRef ? (
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2.5 text-sm">
              <span className="font-medium text-foreground">{editTransferRef.fromAccountName}</span>
              <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
              <span className="font-medium text-foreground">{editTransferRef.toAccountName}</span>
              <span className="ml-auto text-xs text-muted-foreground/50">accounts can&apos;t be changed</span>
            </div>
          ) : (
            <>
              <Controller control={form.control} name="fromAccountId" render={({ field, fieldState }) => (
                <AccountPicker label="From Account"
                  cashAccounts={byType(fromChoices, "CASH_WALLET")}
                  bankAccounts={byType(fromChoices, "BANK_ACCOUNT")}
                  creditAccounts={byType(fromChoices, "CREDIT_CARD")}
                  emergencyFundAccounts={byType(fromChoices, "EMERGENCY_FUND")}
                  investmentAccounts={byType(fromChoices, "INVESTMENT")}
                  value={field.value ?? ""} onChange={field.onChange} error={fieldState.error?.message} />
              )} />
              <Controller control={form.control} name="toAccountId" render={({ field, fieldState }) => (
                <AccountPicker label="To Account"
                  cashAccounts={byType(toChoices, "CASH_WALLET")}
                  bankAccounts={byType(toChoices, "BANK_ACCOUNT")}
                  creditAccounts={byType(toChoices, "CREDIT_CARD")}
                  emergencyFundAccounts={byType(toChoices, "EMERGENCY_FUND")}
                  investmentAccounts={byType(toChoices, "INVESTMENT")}
                  value={field.value ?? ""} onChange={field.onChange} error={fieldState.error?.message} />
              )} />
            </>
          )}
          <Controller control={form.control} name="transferDate" render={({ field, fieldState }) => (
            <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
          )} />
          <FormInput label="Description (optional)" placeholder="e.g. Monthly savings" {...form.register("description")} />
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={isPending}
              className="flex items-center justify-center gap-2 flex-1 h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-60 disabled:shadow-none">
              <Check className="w-4 h-4" /> {isPending ? "Saving…" : submitLabel ?? (isEdit ? "Save Changes" : "Transfer")}
            </button>
            <button type="button" onClick={onCancel}
              className="h-11 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
