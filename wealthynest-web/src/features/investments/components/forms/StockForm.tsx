"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormCurrencyInput } from "@/components/forms/FormCurrencyInput";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { AccountPicker } from "@/components/transactions/AccountPicker";
import { LiveSearch, SelectedChip } from "../LiveSearch";
import { FormButtons } from "./FormButtons";
import { stockSchema, type StockFormValues } from "@/features/investments/schemas/investment.schema";
import { investmentsApi } from "@/features/investments/api/investments.api";
import type { InvestmentSearchResult, Investment } from "@/features/investments/types/investment.types";
import type { PickerAccountList } from "@/features/investments/constants";
import { cn } from "@/lib/utils";

export type StockSubmitValues = StockFormValues & { symbol: string; name: string; exchange: string };

// react-hook-form defaultValues for a z.coerce.number() field may legitimately be a formatted
// string (edit mode pre-fills from a display-formatted value) — zod coerces either at submit time.
export type StockFormDefaults = Partial<Omit<StockFormValues, "units" | "avgBuyPrice">>
  & { units?: number | string; avgBuyPrice?: number | string };

export function StockForm({ defaultValues, onSubmit, onCancel, isPending, bankAccounts, investmentAccounts, editStock, isEditing }: {
  defaultValues?: StockFormDefaults;
  onSubmit: (v: StockSubmitValues) => void;
  onCancel: () => void;
  isPending: boolean;
  bankAccounts: PickerAccountList;
  investmentAccounts: PickerAccountList;
  editStock?: Investment | null;
  isEditing: boolean;
}) {
  const [selected, setSelected] = useState<{ symbol: string; name: string; exchange: string } | null>(
    editStock ? { symbol: editStock.symbol ?? "", name: editStock.companyName ?? editStock.symbol ?? "", exchange: editStock.exchange ?? "NSE" } : null
  );
  // Once more than one transaction exists (a Buy More/Sell has happened), units/avgBuyPrice are
  // derived from the transaction ledger — editing them here would double-count against the rest
  // of the ledger. See InvestmentServiceImpl.updateInvestment for the backend half of this.
  const quantityLocked = isEditing && (editStock?.transactionCount ?? 0) > 1;
  // defaultValues may carry pre-coerce strings for numeric fields (see StockFormDefaults) —
  // zodResolver coerces them to numbers at validation time regardless of this static cast.
  const form = useForm<StockFormValues>({ resolver: zodResolver(stockSchema), defaultValues: defaultValues as Partial<StockFormValues> });

  const handleSelect = (r: InvestmentSearchResult) => {
    setSelected({ symbol: r.symbol ?? "", name: r.name, exchange: r.exchange ?? "NSE" });
  };

  return (
    <form onSubmit={form.handleSubmit(values => {
      if (!selected) return;
      onSubmit({ ...values, ...selected });
    })} className="space-y-4">

      {/* Search / selected chip */}
      {selected ? (
        <SelectedChip
          label={selected.name}
          sub={`${selected.symbol} · ${selected.exchange}`}
          onClear={() => setSelected(null)} />
      ) : (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Search and select a stock <span className="text-red-400">*</span>
          </label>
          <LiveSearch
            placeholder="Type stock name or symbol (e.g. Infosys, RELIANCE)"
            onSearch={investmentsApi.searchStocks}
            renderResult={r => (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-indigo-400">{(r.symbol ?? r.name).slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-muted-foreground/70">{r.symbol}</span>
                    <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded",
                      r.exchange === "BSE"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    )}>{r.exchange ?? "NSE"}</span>
                  </div>
                </div>
              </div>
            )}
            onSelect={handleSelect} />
          <p className="text-xs text-muted-foreground/60 mt-1.5">You must select from the list. Results from NSE and BSE.</p>
        </div>
      )}

      {selected && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quantityLocked && (
            <p className="sm:col-span-2 lg:col-span-3 text-xs text-muted-foreground/80 bg-muted/40 rounded-lg px-3 py-2 -mb-1">
              Quantity and buy price reflect your full transaction history — use <strong>Buy</strong> or <strong>Sell</strong> to change your position instead of editing them here.
            </p>
          )}
          <FormCurrencyInput label="Quantity (shares)" placeholder="0" disabled={quantityLocked} {...form.register("units")}
            error={form.formState.errors.units?.message} />
          <FormCurrencyInput label="Buy Price per Share" placeholder="0" disabled={quantityLocked} {...form.register("avgBuyPrice")}
            error={form.formState.errors.avgBuyPrice?.message} />
          <Controller control={form.control} name="purchaseDate" render={({ field, fieldState }) => (
            <FormDatePicker label="Purchase Date" value={field.value ?? ""} onChange={field.onChange}
              onBlur={field.onBlur} error={fieldState.error?.message} />
          )} />
          {bankAccounts.length > 0 && (
            <Controller control={form.control} name="linkedAccountId" render={({ field }) => (
              <AccountPicker label="Auto-credit Dividends To" allowClear
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
          {!isEditing && (
            <FormCurrencyInput label="Brokerage (optional)" placeholder="0"
              {...form.register("brokerage")} />
          )}
        </div>
      )}

      {selected && <FormButtons onCancel={onCancel} isPending={isPending} label="Save Stock" color="indigo" />}
      {!selected && (
        <button type="button" onClick={onCancel}
          className="text-sm text-muted-foreground/80 hover:text-foreground transition-colors">
          Cancel
        </button>
      )}
    </form>
  );
}
