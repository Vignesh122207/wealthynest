"use client";

import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Building2, Check} from "lucide-react";
import {FormInput} from "@/components/forms/FormInput";
import {FormSelect} from "@/components/forms/FormSelect";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {Button} from "@/components/ui/Button";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {BigAmountInput} from "@/components/transactions/BigAmountInput";
import {ASSET_TYPES} from "@/lib/constants";
import {type AssetFormValues, assetSchema} from "../schemas/asset.schema";

export function AssetForm({ title, defaultValues, onSubmit, onCancel, onDelete, isPending }: {
  title:          string;
  defaultValues?: Partial<AssetFormValues>;
  onSubmit:       (v: AssetFormValues) => void;
  onCancel:       () => void;
  onDelete?:      () => void;
  isPending:      boolean;
}) {
  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: { asOfDate: new Date().toISOString().split("T")[0], ...defaultValues },
  });

  return (
    <TransactionModalOverlay onDismiss={onCancel}>
      <FormModalShell accent="from-emerald-400 to-teal-500">
          <FormModalHeader icon={Building2} tone="emerald" title={title} onDelete={onDelete} onClose={onCancel} />
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormInput label="Name" placeholder="e.g. My Apartment" data-testid="asset-name-input"
              error={form.formState.errors.name?.message} {...form.register("name")} />
            <FormSelect label="Asset Type" options={ASSET_TYPES} placeholder="Select type" data-testid="asset-type-select"
              error={form.formState.errors.assetType?.message} {...form.register("assetType")} />
            <BigAmountInput label="Current Value" colorClass="text-emerald-500 dark:text-emerald-400" testId="asset-current-value-input"
              error={form.formState.errors.currentValue?.message} inputProps={form.register("currentValue")} />
            <div className="grid sm:grid-cols-2 gap-4">
              <FormInput label="Institution / Source" placeholder="e.g. SBI, Employer"
                {...form.register("institution")} />
              <Controller control={form.control} name="asOfDate" render={({ field }) => (
                <FormDatePicker label="As of Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
              )} />
            </div>
            <FormInput label="Notes (optional)" placeholder="Add a note…" {...form.register("notes")} />
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="gradient" loading={isPending} data-testid="asset-form-submit"
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/25 disabled:shadow-none">
                <Check className="w-4 h-4" /> {isPending ? "Saving…" : "Save Asset"}
              </Button>
              <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
            </div>
          </form>
      </FormModalShell>
    </TransactionModalOverlay>
  );
}
