"use client";

import {useMemo} from "react";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {FormInput} from "@/components/forms/FormInput";
import {FormCurrencyInput} from "@/components/forms/FormCurrencyInput";
import {FormSelect} from "@/components/forms/FormSelect";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {AccountPicker} from "@/components/transactions/AccountPicker";
import {FormButtons} from "./FormButtons";
import {type FDFormValues, fdSchema} from "@/features/investments/schemas/investment.schema";
import {COMPOUND_FREQ, type PickerAccountList} from "@/features/investments/constants";
import {formatCurrency} from "@/lib/utils";

export function FDForm({ defaultValues, onSubmit, onCancel, isPending, bankAccounts, investmentAccounts, isEditing }: {
  defaultValues?: Partial<FDFormValues>;
  onSubmit: (v: FDFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  bankAccounts: PickerAccountList;
  investmentAccounts: PickerAccountList;
  isEditing: boolean;
}) {
  const form = useForm<FDFormValues>({
    resolver: zodResolver(fdSchema),
    defaultValues: { compoundingFrequency: "QUARTERLY", ...defaultValues },
  });
  const principal = Number(form.watch("investedAmount") ?? 0);
  const rate      = Number(form.watch("couponRate")      ?? 0);
  const startDate = form.watch("purchaseDate");
  const matDate   = form.watch("maturityDate");
  const compFreq  = form.watch("compoundingFrequency") ?? "QUARTERLY";

  const maturityAmt = useMemo(() => {
    if (!principal || !rate || !startDate || !matDate) return null;
    const days = (new Date(matDate).getTime() - new Date(startDate).getTime()) / 86400000;
    if (days <= 0) return null;
    if (compFreq === "SIMPLE") return principal * (1 + rate / 100 * days / 365);
    const n = compFreq === "MONTHLY" ? 12 : compFreq === "QUARTERLY" ? 4 : compFreq === "HALF_YEARLY" ? 2 : 1;
    return principal * Math.pow(1 + rate / 100 / n, n * days / 365);
  }, [principal, rate, startDate, matDate, compFreq]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FormInput label="Bank / Institution" placeholder="e.g. HDFC Bank" data-testid="fd-bank-name-input"
          {...form.register("bankName")} error={form.formState.errors.bankName?.message} />
        <FormCurrencyInput label="Principal Amount" data-testid="fd-invested-amount-input" {...form.register("investedAmount")}
          error={form.formState.errors.investedAmount?.message} />
        <FormInput label="Interest Rate (% p.a.)" type="number" step="0.01" data-testid="fd-coupon-rate-input"
          {...form.register("couponRate")} error={form.formState.errors.couponRate?.message} />
        <Controller control={form.control} name="purchaseDate" render={({ field, fieldState }) => (
          <FormDatePicker label="FD Start Date" value={field.value ?? ""} onChange={field.onChange}
            onBlur={field.onBlur} error={fieldState.error?.message} testId="fd-purchase-date-input" />
        )} />
        <Controller control={form.control} name="maturityDate" render={({ field, fieldState }) => (
          <FormDatePicker label="Maturity Date" value={field.value ?? ""} onChange={field.onChange}
            onBlur={field.onBlur} error={fieldState.error?.message} testId="fd-maturity-date-input" />
        )} />
        <FormSelect label="Compounding" options={COMPOUND_FREQ} {...form.register("compoundingFrequency")} />
        {maturityAmt != null && (
          <div className="sm:col-span-2 lg:col-span-3 bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Estimated maturity amount</span>
            <span className="text-sm font-bold text-sky-400 tabular-nums">{formatCurrency(maturityAmt)}</span>
          </div>
        )}
        {bankAccounts.length > 0 && (
          <Controller control={form.control} name="linkedAccountId" render={({ field }) => (
            <AccountPicker label="Credit Maturity To" allowClear
              bankAccounts={bankAccounts} value={field.value ?? ""} onChange={field.onChange} testId="fd-linked-account-picker" />
          )} />
        )}
        {!isEditing && (bankAccounts.length > 0 || investmentAccounts.length > 0) && (
          <Controller control={form.control} name="debitAccountId" render={({ field }) => (
            <AccountPicker label="Debit from Account (optional)" placeholder="None (no debit)" allowClear
              bankAccounts={bankAccounts} investmentAccounts={investmentAccounts}
              value={field.value ?? ""} onChange={field.onChange} testId="fd-debit-account-picker" />
          )} />
        )}
      </div>
      <FormButtons onCancel={onCancel} isPending={isPending} label="Save FD" color="sky" />
    </form>
  );
}
