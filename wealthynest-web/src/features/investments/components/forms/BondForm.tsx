"use client";

import {useEffect, useMemo, useRef} from "react";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {FormInput} from "@/components/forms/FormInput";
import {FormCurrencyInput} from "@/components/forms/FormCurrencyInput";
import {FormSelect} from "@/components/forms/FormSelect";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {AccountPicker} from "@/components/transactions/AccountPicker";
import {FormButtons} from "./FormButtons";
import {BrokerAndPurposeFields} from "./BrokerAndPurposeFields";
import {type BondFormValues, bondSchema} from "@/features/investments/schemas/investment.schema";
import {COUPON_FREQ, type PickerAccountList} from "@/features/investments/constants";
import {formatCurrency} from "@/lib/utils";

export type BondSubmitValues = BondFormValues & { _investedAmount: number };

export function BondForm({ defaultValues, onSubmit, onCancel, isPending, bankAccounts, isEditing }: {
  defaultValues?: Partial<BondFormValues>;
  onSubmit: (v: BondSubmitValues) => void;
  onCancel: () => void;
  isPending: boolean;
  bankAccounts: PickerAccountList;
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

  // Auto-fill totalInvested when face value or quantity changes, but only if the user hasn't
  // overridden it. Tracks the *last value this effect itself set* rather than comparing against
  // today's newly-expected total — comparing against today's expected value was a real bug:
  // filling Face Value first (auto-setting totalInvested at faceValue*1, the default quantity)
  // then Quantity second left totalInvested permanently stuck, because that check treated
  // "doesn't match the newly-recomputed total" as "the user overrode it", even though this
  // effect itself had set the stale value moments earlier.
  const lastAutoTotalRef = useRef<number | null>(null);
  useEffect(() => {
    if (faceVal > 0 && qty > 0) {
      const current = Number(form.getValues("totalInvested") ?? 0);
      const expected = faceVal * qty;
      const stillFollowing = !current
        || (lastAutoTotalRef.current !== null && Math.abs(current - lastAutoTotalRef.current) < 0.01);
      if (stillFollowing) {
        form.setValue("totalInvested", expected);
        lastAutoTotalRef.current = expected;
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
            data-testid="bond-name-input"
            {...form.register("companyName")} error={form.formState.errors.companyName?.message} />
        </div>
        <FormCurrencyInput label="Face Value per Bond" data-testid="bond-face-value-input" {...form.register("faceValuePerBond")}
          error={form.formState.errors.faceValuePerBond?.message} />
        <FormInput label="Quantity (no. of bonds)" type="number" min="1"
          data-testid="bond-quantity-input"
          {...form.register("quantity")} error={form.formState.errors.quantity?.message} />
        <FormCurrencyInput label="Total Invested" data-testid="bond-total-invested-input" {...form.register("totalInvested")}
          error={form.formState.errors.totalInvested?.message} />
        <FormInput label="Coupon Rate (% p.a.)" type="number" step="0.01"
          data-testid="bond-coupon-rate-input"
          {...form.register("couponRate")} error={form.formState.errors.couponRate?.message} />
        <FormSelect label="Coupon Frequency" options={COUPON_FREQ} {...form.register("couponFrequency")} />
        <FormInput label="TDS Rate (%, 0 if N/A)" type="number" step="0.01" min="0" max="30"
          placeholder="e.g. 10"
          {...form.register("tdsRate")} error={form.formState.errors.tdsRate?.message} />
        <FormInput label="Credit Day of Month (1–31) (optional)" type="number" min="1" max="31"
          placeholder="e.g. 15"
          {...form.register("couponCreditDay")} error={form.formState.errors.couponCreditDay?.message} />
        <Controller control={form.control} name="purchaseDate" render={({ field, fieldState }) => (
          <FormDatePicker label="Purchase Date" value={field.value ?? ""} onChange={field.onChange}
            onBlur={field.onBlur} error={fieldState.error?.message} testId="bond-purchase-date-input" />
        )} />
        <Controller control={form.control} name="maturityDate" render={({ field }) => (
          <FormDatePicker label="Maturity Date (optional)" value={field.value ?? ""} onChange={field.onChange}
            onBlur={field.onBlur} placeholder="Leave blank if perpetual" testId="bond-maturity-date-input" />
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
            <AccountPicker label="Credit Coupons To (optional)" allowClear
              bankAccounts={bankAccounts} value={field.value ?? ""} onChange={field.onChange} />
          )} />
        )}
        {!isEditing && bankAccounts.length > 0 && (
          <Controller control={form.control} name="debitAccountId" render={({ field }) => (
            <AccountPicker label="Debit from Account (optional)" placeholder="None (no debit)" allowClear
              bankAccounts={bankAccounts}
              value={field.value ?? ""} onChange={field.onChange} />
          )} />
        )}
        <BrokerAndPurposeFields form={form} />
      </div>
      <FormButtons onCancel={onCancel} isPending={isPending} label="Save Bond" color="violet" />
    </form>
  );
}
