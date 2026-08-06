"use client";

import type {FieldValues, Path, UseFormReturn} from "react-hook-form";
import {PurposePicker} from "@/components/forms/PurposePicker";
import {BankNameInput} from "@/features/accounts/components/BankNameInput";
import {STOCK_BROKERS} from "@/lib/constants";

type PurposeFields = { broker?: string; purpose?: string; purposeLabel?: string };

// Shared across all 5 investment-type forms (Stock/MF/Gold/FD/Bond) — broker + purpose are the
// same optional metadata regardless of investment type, so the field markup lives here once.
export function BrokerAndPurposeFields<T extends FieldValues & PurposeFields>({ form, showBroker = true }: {
  form: UseFormReturn<T>;
  /** A Fixed Deposit already has a required Bank/Institution field answering "who holds this" —
   * showing Broker/Platform too just asks the same question twice, using a stock-brokerage
   * suggestion list (Zerodha, Groww…) that doesn't even apply to an FD. FDForm passes false. */
  showBroker?: boolean;
}) {
  const purpose = form.watch("purpose" as Path<T>) as string | undefined;
  const broker  = form.watch("broker" as Path<T>) as string | undefined;
  const errors  = form.formState.errors as Partial<Record<keyof PurposeFields, { message?: string }>>;

  return (
    <>
      {showBroker && (
        <BankNameInput label="Broker / Platform (optional)" suggestions={STOCK_BROKERS}
          value={broker ?? ""}
          onChange={v => form.setValue("broker" as Path<T>, (v || undefined) as never, { shouldValidate: true })} />
      )}
      <div className="space-y-2">
        <PurposePicker label="Purpose (optional)" placeholder="What is this for?"
          error={errors.purpose?.message}
          value={purpose ?? ""}
          onChange={v => form.setValue("purpose" as Path<T>, (v || undefined) as never, { shouldValidate: true })} />
        {purpose === "CUSTOM" && (
          <div>
            <input {...form.register("purposeLabel" as Path<T>)} placeholder="e.g. Down payment fund"
              className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
            {errors.purposeLabel && <p className="text-xs text-red-500 mt-1">{errors.purposeLabel.message}</p>}
          </div>
        )}
      </div>
    </>
  );
}
