"use client";

import {useState} from "react";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {FormCurrencyInput} from "@/components/forms/FormCurrencyInput";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {AccountPicker} from "@/components/transactions/AccountPicker";
import {LiveSearch, SelectedChip} from "../LiveSearch";
import {FormButtons} from "./FormButtons";
import {type MFFormValues, mfSchema} from "@/features/investments/schemas/investment.schema";
import {investmentsApi} from "@/features/investments/api/investments.api";
import type {Investment} from "@/features/investments/types/investment.types";
import type {PickerAccountList} from "@/features/investments/constants";

export type MFSubmitValues = MFFormValues & { schemeCode: string; name: string };

// react-hook-form defaultValues for a z.coerce.number() field may legitimately be a formatted
// string (edit mode pre-fills from a display-formatted value) — zod coerces either at submit time.
export type MFFormDefaults = Partial<Omit<MFFormValues, "units" | "avgBuyPrice">>
  & { units?: number | string; avgBuyPrice?: number | string };

export function MFForm({ defaultValues, onSubmit, onCancel, isPending, bankAccounts, investmentAccounts, editMF, isEditing }: {
  defaultValues?: MFFormDefaults;
  onSubmit: (v: MFSubmitValues) => void;
  onCancel: () => void;
  isPending: boolean;
  bankAccounts: PickerAccountList;
  investmentAccounts: PickerAccountList;
  editMF?: Investment | null;
  isEditing: boolean;
}) {
  const [selected, setSelected] = useState<{ schemeCode: string; name: string } | null>(
    editMF ? { schemeCode: editMF.schemeCode ?? "", name: editMF.companyName ?? "" } : null
  );
  // defaultValues may carry pre-coerce strings for numeric fields (see MFFormDefaults) —
  // zodResolver coerces them to numbers at validation time regardless of this static cast.
  const form = useForm<MFFormValues>({ resolver: zodResolver(mfSchema), defaultValues: defaultValues as Partial<MFFormValues> });

  return (
    <form onSubmit={form.handleSubmit(values => {
      if (!selected) return;
      onSubmit({ ...values, ...selected });
    })} className="space-y-4">

      {selected ? (
        <SelectedChip label={selected.name} sub={`Code: ${selected.schemeCode}`} onClear={() => setSelected(null)} />
      ) : (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Search and select a fund <span className="text-red-400">*</span>
          </label>
          <LiveSearch
            placeholder="Type fund name (e.g. Mirae, SBI Bluechip)"
            minChars={3}
            onSearch={investmentsApi.searchMF}
            renderResult={r => (
              <p className="text-sm font-medium text-foreground leading-snug">{r.name}</p>
            )}
            onSelect={r => setSelected({ schemeCode: r.schemeCode ?? "", name: r.name })} />
          <p className="text-xs text-muted-foreground/60 mt-1.5">Powered by MFAPI · Type at least 3 characters</p>
        </div>
      )}

      {selected && (
        <div className="grid sm:grid-cols-2 gap-4">
          <FormCurrencyInput label="Units" {...form.register("units")}
            error={form.formState.errors.units?.message} />
          <FormCurrencyInput label="Buy NAV (per unit)" {...form.register("avgBuyPrice")}
            error={form.formState.errors.avgBuyPrice?.message} />
          <Controller control={form.control} name="purchaseDate" render={({ field, fieldState }) => (
            <FormDatePicker label="Purchase Date" value={field.value ?? ""} onChange={field.onChange}
              onBlur={field.onBlur} error={fieldState.error?.message} />
          )} />
          {bankAccounts.length > 0 && (
            <Controller control={form.control} name="linkedAccountId" render={({ field }) => (
              <AccountPicker label="Link Account (SIP tracking)" allowClear
                bankAccounts={bankAccounts} value={field.value ?? ""} onChange={field.onChange} />
            )} />
          )}
          {!isEditing && (bankAccounts.length > 0 || investmentAccounts.length > 0) && (
            <Controller control={form.control} name="debitAccountId" render={({ field }) => (
              <AccountPicker label="Debit from Account (optional)" placeholder="None (no debit)" allowClear
                bankAccounts={bankAccounts} investmentAccounts={investmentAccounts}
                value={field.value ?? ""} onChange={field.onChange} />
            )} />
          )}
        </div>
      )}

      {selected && <FormButtons onCancel={onCancel} isPending={isPending} label="Save Fund" color="emerald" />}
      {!selected && (
        <button type="button" onClick={onCancel}
          className="text-sm text-muted-foreground/80 hover:text-foreground transition-colors">
          Cancel
        </button>
      )}
    </form>
  );
}
