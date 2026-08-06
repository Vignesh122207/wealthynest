"use client";

import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {TrendingDown, TrendingUp} from "lucide-react";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {FormCurrencyInput} from "@/components/forms/FormCurrencyInput";
import {AccountPicker} from "@/components/transactions/AccountPicker";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {useAddStockTransaction} from "@/features/investments/hooks/useInvestments";
import {type StockTxnFormValues, stockTxnSchema} from "@/features/investments/schemas/investment.schema";
import {fmtNum} from "@/features/investments/utils/formatNum";
import type {PickerAccountList} from "@/features/investments/constants";
import type {Investment} from "@/features/investments/types/investment.types";
import {cn, formatCurrency} from "@/lib/utils";

export function StockTransactionModal({ inv, type, onClose, bankAccounts }: {
  inv: Investment; type: "BUY" | "SELL"; onClose: () => void;
  bankAccounts: PickerAccountList;
}) {
  const isBuy = type === "BUY";
  const maxQty = isBuy ? undefined : Number(inv.units ?? 0);

  const { mutate: addTxn, isPending } = useAddStockTransaction();
  const form = useForm<StockTxnFormValues>({ resolver: zodResolver(stockTxnSchema(isBuy, maxQty)),
    defaultValues: {
      transactionDate: new Date().toISOString().slice(0, 10),
      quantity: undefined as unknown as number,
      pricePerShare: (inv.livePrice ?? inv.currentPrice ?? undefined) as unknown as number,
      brokerage: undefined,
      accountId: "",
    }
  });

  const qty       = Number(form.watch("quantity") ?? 0);
  const price     = Number(form.watch("pricePerShare") ?? 0);
  const brokerage = Number(form.watch("brokerage") ?? 0);
  const avgBuy    = Number(inv.avgBuyPrice ?? 0);

  const grossAmount = qty > 0 && price > 0 ? qty * price : null;
  // BUY: total cost = qty × price + brokerage; SELL: net proceeds = qty × price − brokerage
  const netAmount = grossAmount != null
    ? (isBuy ? grossAmount + brokerage : grossAmount - brokerage) : null;
  // Estimated realized P&L on sell
  const realizedPnl = !isBuy && qty > 0 && price > 0 && avgBuy > 0
    ? (price - avgBuy) * qty - brokerage : null;

  const handleSubmit = (values: StockTxnFormValues) => {
    addTxn({ investmentId: inv.id, data: {
      transactionDate: values.transactionDate,
      transactionType: type,
      quantity:        Number(values.quantity),
      pricePerShare:   Number(values.pricePerShare),
      brokerage:       values.brokerage ? Number(values.brokerage) : undefined,
      debitAccountId:  values.accountId || undefined,
    } }, { onSuccess: onClose });
  };

  const accent = isBuy ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/25"
    : "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 shadow-red-500/25";
  const title  = isBuy ? "Buy" : "Sell Shares";

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
        <div className={cn("h-1.5 bg-gradient-to-r", isBuy ? "from-emerald-400 to-teal-500" : "from-red-400 to-rose-500")} />
        <div className="p-5">
          <FormModalHeader icon={isBuy ? TrendingUp : TrendingDown} tone={isBuy ? "green" : "red"}
            title={`${title} — ${inv.companyName ?? inv.symbol}`} onClose={onClose} />

        {!isBuy && inv.units != null && (
          <div className="mb-3 p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Holdings</span>
            <span className="text-xs font-semibold text-foreground">{fmtNum(Number(inv.units))} shares @ avg {formatCurrency(avgBuy)}</span>
          </div>
        )}

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Controller control={form.control} name="transactionDate" render={({ field, fieldState }) => (
              <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange}
                onBlur={field.onBlur} error={fieldState.error?.message} />
            )} />
            <div>
              <FormCurrencyInput
                label={isBuy ? "Quantity (shares)" : `Quantity (max ${fmtNum(maxQty ?? 0)})`}
                {...form.register("quantity")}
                error={form.formState.errors.quantity?.message}
              />
            </div>
            <FormCurrencyInput label="Price per Share" {...form.register("pricePerShare")}
              error={form.formState.errors.pricePerShare?.message} />
            <FormCurrencyInput label="Brokerage (optional)" placeholder="0" {...form.register("brokerage")} />
          </div>

          {/* Summary preview */}
          {netAmount != null && (
            <div className={cn("rounded-xl border px-3 py-2 space-y-1",
              isBuy ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20")}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{isBuy ? "Total cost" : "Net proceeds"}</span>
                <span className={cn("text-sm font-bold tabular-nums", isBuy ? "text-emerald-400" : "text-red-300")}>
                  {formatCurrency(netAmount)}
                </span>
              </div>
              {!isBuy && realizedPnl != null && (
                <div className="flex items-center justify-between border-t border-red-500/10 pt-1">
                  <span className="text-xs text-muted-foreground">Estimated P&amp;L</span>
                  <span className={cn("text-xs font-semibold tabular-nums", realizedPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {realizedPnl >= 0 ? "+" : ""}{formatCurrency(realizedPnl)}
                  </span>
                </div>
              )}
            </div>
          )}

          {bankAccounts.length > 0 && (
            <Controller control={form.control} name="accountId" render={({ field }) => (
              <AccountPicker
                label={isBuy ? "Debit from Account (optional)" : "Credit proceeds to Account (optional)"}
                placeholder={isBuy ? "None (no debit)" : "None (track only)"}
                bankAccounts={bankAccounts}
                allowClear value={field.value ?? ""} onChange={field.onChange} />
            )} />
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={isPending}
              className={cn("flex-1 h-11 rounded-xl text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-60 disabled:shadow-none", accent)}>
              {isPending ? "Saving…" : title}
            </button>
            <button type="button" onClick={onClose}
              className="h-11 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
          </div>
        </form>
        </div>
      </div>
    </TransactionModalOverlay>
  );
}
