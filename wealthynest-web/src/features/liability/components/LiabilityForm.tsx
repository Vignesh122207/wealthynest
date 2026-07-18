"use client";

import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {AlertTriangle, Check} from "lucide-react";
import {FormInput} from "@/components/forms/FormInput";
import {FormSelect} from "@/components/forms/FormSelect";
import {FormCurrencyInput} from "@/components/forms/FormCurrencyInput";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {Button} from "@/components/ui/Button";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {BigAmountInput} from "@/components/transactions/BigAmountInput";
import {LIABILITY_TYPES} from "@/lib/constants";
import {type LiabilityFormValues, liabilitySchema} from "../schemas/liability.schema";

export function LiabilityForm({ title, defaultValues, onSubmit, onCancel, onDelete, isPending }: {
  title:          string;
  defaultValues?: Partial<LiabilityFormValues>;
  onSubmit:       (v: LiabilityFormValues) => void;
  onCancel:       () => void;
  onDelete?:      () => void;
  isPending:      boolean;
}) {
  const form = useForm<LiabilityFormValues>({
    resolver: zodResolver(liabilitySchema),
    defaultValues,
  });

  return (
    <TransactionModalOverlay onDismiss={onCancel}>
      <FormModalShell accent="from-red-400 to-rose-500">
          <FormModalHeader icon={AlertTriangle} tone="red" title={title} onDelete={onDelete} onClose={onCancel} />
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormInput label="Name" placeholder="e.g. HDFC Home Loan" data-testid="liability-name-input"
              error={form.formState.errors.name?.message} {...form.register("name")} />
            <FormSelect label="Type" options={LIABILITY_TYPES} placeholder="Select type" data-testid="liability-type-select"
              error={form.formState.errors.liabilityType?.message} {...form.register("liabilityType")} />
            <BigAmountInput label="Outstanding Balance" colorClass="text-red-500 dark:text-red-400" testId="liability-outstanding-input"
              error={form.formState.errors.outstandingAmount?.message} inputProps={form.register("outstandingAmount")} />
            <div className="grid sm:grid-cols-2 gap-4">
              <FormCurrencyInput label="Original Loan Amount" placeholder="0"
                error={form.formState.errors.principalAmount?.message} {...form.register("principalAmount")} />
              <FormCurrencyInput label="Monthly EMI" placeholder="0"
                {...form.register("emiAmount")} />
              <FormInput label="Interest Rate (% p.a.)" type="number" placeholder="8.5"
                {...form.register("interestRate")} />
              <FormInput label="Lender / Bank" placeholder="e.g. HDFC Bank" {...form.register("lenderName")} />
              <Controller control={form.control} name="startDate" render={({ field }) => (
                <FormDatePicker label="Start Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
              )} />
              <Controller control={form.control} name="endDate" render={({ field }) => (
                <FormDatePicker label="Expected Payoff Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
              )} />
            </div>
            <FormInput label="Notes (optional)" placeholder="Add a note…" {...form.register("notes")} />
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="gradient" loading={isPending} data-testid="liability-form-submit"
                className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 shadow-red-500/25 disabled:shadow-none">
                <Check className="w-4 h-4" /> {isPending ? "Saving…" : "Save Liability"}
              </Button>
              <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
            </div>
          </form>
      </FormModalShell>
    </TransactionModalOverlay>
  );
}
