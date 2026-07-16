"use client";

import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormInput } from "@/components/forms/FormInput";
import { FormCurrencyInput } from "@/components/forms/FormCurrencyInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { AccountPicker } from "@/components/transactions/AccountPicker";
import { FormButtons } from "./FormButtons";
import { bondSchema, type BondFormValues } from "@/features/investments/schemas/investment.schema";
import { COUPON_FREQ, type PickerAccountList } from "@/features/investments/constants";
import { formatCurrency } from "@/lib/utils";

export type BondSubmitValues = BondFormValues & { _investedAmount: number };

export function BondForm({ defaultValues, onSubmit, onCancel, isPending, bankAccounts, investmentAccounts, isEditing }: {
  defaultValues?: Partial<BondFormValues>;
  onSubmit: (v: BondSubmitValues) => void;
  onCancel: () => void;
  isPending: boolean;
  bankAccounts: PickerAccountList;
  investmentAccounts: PickerAccountList;
  isEditing: boolean;
}) {
  const form = useForm<BondFormValues>({
    resolver: zodResolver(bondSchema),
    defaultValues: { couponFrequency: "HALF_YEARLY", quantity: 1, ...defaultValues },
  });
  const faceVal  = Number(form.watch("faceValuePerBond") ?? 0);
  const qty      = Number(form.watch("quantity")          ?? 1);
  const rate     = Number(form.watch("couponRate")         ?? 0);
  const freq     = form.watch("couponFrequency") ?? "HALF_YEARLY";
  const tdsRateW = Number(form.watch("tdsRate")            ?? 0);

  // Auto-fill totalInvested when face value or quantity changes, but only if user hasn't overridden it
  useEffect(() => {
    if (faceVal > 0 && qty > 0) {
      const current = Number(form.getValues("totalInvested") ?? 0);
      const expected = faceVal * qty;
      // Only auto-set if blank or still matches a previous face-value calculation
      if (!current || Math.abs(current - expected) < 0.01) {
        form.setValue("totalInvested", expected);
      }
    }
  }, [faceVal, qty]); // eslint-disable-line react-hooks/exhaustive-deps

  const grossCouponAmt = useMemo(() => {
    if (!faceVal || !qty || !rate) return null;
    const n = freq === "MONTHLY" ? 12 : freq === "QUARTERLY" ? 4 : freq === "HALF_YEARLY" ? 2 : 1;
    return (faceVal * qty * rate / 100) / n;
  }, [faceVal, qty, rate, freq]);

  const netCouponAmt = grossCouponAmt != null && tdsRateW > 0
    ? grossCouponAmt * (1 - tdsRateW / 100)
    : grossCouponAmt;

  return (
    <form onSubmit={form.handleSubmit(values => onSubmit({ ...values, _investedAmount: Number(values.totalInvested) }))} className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2 lg:col-span-3">
          <FormInput label="Bond Name" placeholder="e.g. RBI Savings Bond, Govt of India 7.26% 2032"
            {...form.register("companyName")} error={form.formState.errors.companyName?.message} />
        </div>
        <FormCurrencyInput label="Face Value per Bond" {...form.register("faceValuePerBond")}
          error={form.formState.errors.faceValuePerBond?.message} />
        <FormInput label="Quantity (no. of bonds)" type="number" min="1"
          {...form.register("quantity")} error={form.formState.errors.quantity?.message} />
        <FormCurrencyInput label="Total Invested" {...form.register("totalInvested")}
          error={form.formState.errors.totalInvested?.message} />
        <FormInput label="Coupon Rate (% p.a.)" type="number" step="0.01"
          {...form.register("couponRate")} error={form.formState.errors.couponRate?.message} />
        <FormSelect label="Coupon Frequency" options={COUPON_FREQ} {...form.register("couponFrequency")} />
        <FormInput label="TDS Rate (%, 0 if N/A)" type="number" step="0.01" min="0" max="30"
          placeholder="e.g. 10"
          {...form.register("tdsRate")} />
        <FormInput label="Credit Day of Month (1–31)" type="number" min="1" max="31"
          placeholder="e.g. 15"
          {...form.register("couponCreditDay")} />
        <Controller control={form.control} name="purchaseDate" render={({ field, fieldState }) => (
          <FormDatePicker label="Purchase Date" value={field.value ?? ""} onChange={field.onChange}
            onBlur={field.onBlur} error={fieldState.error?.message} />
        )} />
        <Controller control={form.control} name="maturityDate" render={({ field }) => (
          <FormDatePicker label="Maturity Date (optional)" value={field.value ?? ""} onChange={field.onChange}
            onBlur={field.onBlur} placeholder="Leave blank if perpetual" />
        )} />
        {grossCouponAmt != null && (
          <div className="sm:col-span-2 lg:col-span-3 bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Gross coupon per {freq.toLowerCase().replace("_", "-")} period</span>
              <span className="text-sm font-semibold text-violet-300/70 tabular-nums">{formatCurrency(grossCouponAmt)}</span>
            </div>
            {tdsRateW > 0 && netCouponAmt != null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Net coupon after {tdsRateW}% TDS</span>
                <span className="text-sm font-bold text-violet-400 tabular-nums">{formatCurrency(netCouponAmt)}</span>
              </div>
            )}
          </div>
        )}
        {bankAccounts.length > 0 && (
          <Controller control={form.control} name="linkedAccountId" render={({ field }) => (
            <AccountPicker label="Credit Coupons To" allowClear
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
      <FormButtons onCancel={onCancel} isPending={isPending} label="Save Bond" color="violet" />
    </form>
  );
}
