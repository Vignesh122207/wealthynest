"use client";

import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Building2, Check} from "lucide-react";
import {FormInput} from "@/components/forms/FormInput";
import {IconOptionPicker} from "@/components/forms/IconOptionPicker";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {Button} from "@/components/ui/Button";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {BigAmountInput} from "@/components/transactions/BigAmountInput";
import {ASSET_TYPE_ICON_OPTIONS} from "@/lib/netWorthTypeMeta";
import {todayLocalISO} from "@/lib/date";
import {type AssetFormValues, assetSchema} from "../schemas/asset.schema";

// "Institution / Source" meant something different for every asset type but showed one static
// bank-oriented label+placeholder ("e.g. SBI, Employer") regardless — confusing for a Vehicle or
// a piece of Gold Jewelry, which don't have anything resembling an "institution" at all. Adapts
// per type instead, and disappears entirely for VEHICLE, where nothing in this shape applies.
const INSTITUTION_META: Record<string, { label: string; placeholder: string } | null> = {
  REAL_ESTATE:     { label: "Registered With",  placeholder: "e.g. Sub-Registrar Office, Builder" },
  VEHICLE:         null,
  GOLD_JEWELRY:    { label: "Purchased From",    placeholder: "e.g. Tanishq, family heirloom" },
  EPF_PPF:         { label: "Provider",          placeholder: "e.g. EPFO, Post Office" },
  BUSINESS_EQUITY: { label: "Company Name",      placeholder: "e.g. Acme Pvt Ltd" },
  RECEIVABLES:     { label: "Owed By",           placeholder: "e.g. Rahul, a client name" },
  OTHER:           { label: "Source",            placeholder: "Describe where this comes from" },
};

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
    defaultValues: { asOfDate: todayLocalISO(), ...defaultValues },
  });
  const assetType = form.watch("assetType");
  const institutionMeta = INSTITUTION_META[assetType ?? ""] ?? INSTITUTION_META.OTHER;

  return (
    <TransactionModalOverlay onDismiss={onCancel}>
      <FormModalShell accent="from-emerald-400 to-teal-500">
          <FormModalHeader icon={Building2} tone="emerald" title={title} onDelete={onDelete} onClose={onCancel} />
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormInput label="Name" placeholder="e.g. My Apartment" data-testid="asset-name-input"
              error={form.formState.errors.name?.message} {...form.register("name")} />
            <Controller control={form.control} name="assetType" render={({ field, fieldState }) => (
              <IconOptionPicker label="Asset Type" options={ASSET_TYPE_ICON_OPTIONS} testId="asset-type-picker"
                value={field.value ?? ""} onChange={field.onChange} error={fieldState.error?.message} />
            )} />
            <BigAmountInput label="Current Value" colorClass="text-emerald-500 dark:text-emerald-400" testId="asset-current-value-input"
              error={form.formState.errors.currentValue?.message} inputProps={form.register("currentValue")} />
            <div className="grid sm:grid-cols-2 gap-4">
              {institutionMeta && (
                <FormInput label={`${institutionMeta.label} (optional)`} placeholder={institutionMeta.placeholder}
                  {...form.register("institution")} />
              )}
              <FormInput label="Reference / Account Number (optional)" placeholder="e.g. registration or account no."
                error={form.formState.errors.accountNumber?.message} {...form.register("accountNumber")} />
              <Controller control={form.control} name="asOfDate" render={({ field }) => (
                <FormDatePicker label="As of Date (optional)" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
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
