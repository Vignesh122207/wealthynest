"use client";

import {useEffect} from "react";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Coins} from "lucide-react";
import {FormInput} from "@/components/forms/FormInput";
import {FormCurrencyInput} from "@/components/forms/FormCurrencyInput";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {AccountPicker} from "@/components/transactions/AccountPicker";
import {FormButtons} from "./FormButtons";
import {type GoldFormValues, goldSchema} from "@/features/investments/schemas/investment.schema";
import {KARAT_OPTIONS, type PickerAccountList} from "@/features/investments/constants";
import {formatCurrency} from "@/lib/utils";

type GoldPrice = { price18k: number; price22k: number; price24k: number };

export function GoldForm({ defaultValues, onSubmit, onCancel, isPending, goldPrice, bankAccounts, investmentAccounts, isEditing }: {
  defaultValues?: Partial<GoldFormValues>;
  onSubmit: (v: GoldFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  goldPrice?: GoldPrice;
  bankAccounts: PickerAccountList;
  investmentAccounts: PickerAccountList;
  isEditing: boolean;
}) {
  const form = useForm<GoldFormValues>({
    resolver: zodResolver(goldSchema),
    defaultValues: { goldKarat: 22, ...defaultValues },
  });
  const qty      = Number(form.watch("quantityGrams") ?? 0);
  const buyPrice = Number(form.watch("avgBuyPrice")   ?? 0);
  const karat    = Number(form.watch("goldKarat")     ?? 22);

  const karatKey   = `price${karat}k` as keyof GoldPrice;
  const livePrice  = goldPrice ? goldPrice[karatKey] : null;

  // Auto-suggest current live price when buy price is blank and live price loads
  useEffect(() => {
    if (livePrice && !form.getValues("avgBuyPrice")) {
      form.setValue("avgBuyPrice", Math.round(livePrice));
    }
  }, [livePrice, karat]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentVal = qty > 0 && livePrice ? qty * livePrice : null;
  const invested   = qty > 0 && buyPrice  ? qty * buyPrice  : null;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {goldPrice && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <Coins className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300">
            Live {karat}K gold: <strong>{livePrice ? formatCurrency(livePrice) : "—"}/gram</strong>
            <span className="text-muted-foreground/80 ml-2">
              (24K {formatCurrency(goldPrice.price24k ?? 0)} · 22K {formatCurrency(goldPrice.price22k ?? 0)} · 18K {formatCurrency(goldPrice.price18k ?? 0)})
            </span>
          </span>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <FormInput label="Description" placeholder="e.g. Digital Gold, Physical Gold" data-testid="gold-description-input"
          {...form.register("companyName")} error={form.formState.errors.companyName?.message} />
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Karat</label>
          <select {...form.register("goldKarat", { valueAsNumber: true })}
            className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-amber-500">
            {KARAT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {form.formState.errors.goldKarat?.message && (
            <p className="text-xs text-red-400 mt-1">{form.formState.errors.goldKarat.message}</p>
          )}
        </div>
        <FormCurrencyInput label="Quantity (grams)" data-testid="gold-quantity-input" {...form.register("quantityGrams")}
          error={form.formState.errors.quantityGrams?.message} />
        <FormCurrencyInput label="Buy Price per Gram" data-testid="gold-buy-price-input" {...form.register("avgBuyPrice")}
          error={form.formState.errors.avgBuyPrice?.message} />
        <Controller control={form.control} name="purchaseDate" render={({ field, fieldState }) => (
          <FormDatePicker label="Purchase Date" value={field.value ?? ""} onChange={field.onChange}
            onBlur={field.onBlur} error={fieldState.error?.message} testId="gold-purchase-date-input" />
        )} />
        {(invested != null || currentVal != null) && (
          <div className="sm:col-span-2 grid grid-cols-2 gap-2">
            {invested != null && (
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground/80 mb-0.5">Amount invested</p>
                <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(invested)}</p>
              </div>
            )}
            {currentVal != null && (
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground/80 mb-0.5">Current market value ({karat}K)</p>
                <p className="text-sm font-bold text-amber-400 tabular-nums">{formatCurrency(currentVal)}</p>
              </div>
            )}
          </div>
        )}
        {!isEditing && (bankAccounts.length > 0 || investmentAccounts.length > 0) && (
          <Controller control={form.control} name="debitAccountId" render={({ field }) => (
            <AccountPicker label="Debit from Account (optional)" placeholder="None (no debit)" allowClear
              bankAccounts={bankAccounts} investmentAccounts={investmentAccounts}
              value={field.value ?? ""} onChange={field.onChange} />
          )} />
        )}
      </div>
      <FormButtons onCancel={onCancel} isPending={isPending} label="Save Gold" color="amber" />
    </form>
  );
}
