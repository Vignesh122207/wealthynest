"use client";

import {useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {CalendarDays, ChevronDown, ChevronUp, Plus, Trash2} from "lucide-react";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {FormCurrencyInput} from "@/components/forms/FormCurrencyInput";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {
    useAddSipTransaction,
    useDeleteSipTransaction,
    useSipTransactions,
} from "@/features/investments/hooks/useInvestments";
import {sipSchema} from "@/features/investments/schemas/investment.schema";
import type {SipTransaction} from "@/features/investments/types/investment.types";
import {cn, formatDate} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";

export function SipSection({ investmentId }: { investmentId: string }) {
  const { fmt } = useAmountFormatter();
  const [open, setOpen]           = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { data: sips = [], isLoading: sipsLoading } = useSipTransactions(open ? investmentId : null);
  const { mutate: addSip, isPending }               = useAddSipTransaction();
  const { mutate: deleteSip }                       = useDeleteSipTransaction();

  // `amount` starts undefined (not 0) so the currency field renders genuinely blank on a new
  // SIP entry rather than pre-filled — react-hook-form's DefaultValues<T> allows this per-field
  // regardless of the schema's own (non-optional) output type.
  const form = useForm({
    resolver: zodResolver(sipSchema),
    defaultValues: { transactionDate: new Date().toISOString().slice(0, 10), amount: undefined, units: "", nav: "" },
  });

  const onAddSip = form.handleSubmit((vals) => {
    addSip({
      investmentId,
      data: {
        transactionDate: vals.transactionDate,
        amount:          Number(vals.amount),
        units:           vals.units ? Number(vals.units) : undefined,
        nav:             vals.nav   ? Number(vals.nav)   : undefined,
        transactionType: "BUY",
      },
    }, {
      onSuccess: () => { form.reset({ transactionDate: new Date().toISOString().slice(0, 10), amount: undefined, units: "", nav: "" }); setShowAdd(false); },
    });
  });

  return (
    <div className="mt-2 pt-2 border-t border-border/60">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setOpen(v => !v); if (!open) setShowAdd(false); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-foreground transition-colors"
        >
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          SIP entries {sips.length > 0 && !open ? `(${sips.length})` : ""}
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-1.5">
          {sipsLoading ? (
            <div className="h-8 bg-muted/30 rounded-lg animate-pulse" />
          ) : sips.length === 0 ? (
            <p className="text-xs text-muted-foreground/80 pl-1">No SIP entries yet.</p>
          ) : (
            sips.map((s: SipTransaction) => (
              <div key={s.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-2.5 py-1.5 group/sip">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <span className="text-xs text-muted-foreground">{formatDate(s.transactionDate)}</span>
                  {s.units && <span className="text-xs text-muted-foreground/80">{Number(s.units).toFixed(3)} u</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-xs font-semibold tabular-nums", s.transactionType === "REDEEM" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                    {s.transactionType === "REDEEM" ? "-" : "+"}{fmt(s.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setDeletingId(s.id); }}
                    className="opacity-0 group-hover/sip:opacity-100 w-5 h-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}

          {deletingId !== null && (
            <ConfirmDialog open
              title="Delete SIP entry"
              description="This SIP transaction will be permanently removed and totals will be recalculated."
              confirmLabel="Delete" danger
              onConfirm={() => { deleteSip({ investmentId, sipId: deletingId }); setDeletingId(null); }}
              onCancel={() => setDeletingId(null)} />
          )}

          {showAdd ? (
            <form onSubmit={onAddSip} className="bg-muted/20 rounded-xl p-3 space-y-2 mt-1">
              <div className="grid grid-cols-2 gap-2">
                <FormDatePicker label="Date" value={form.watch("transactionDate") ?? ""} onChange={v => form.setValue("transactionDate", v)} />
                <FormCurrencyInput label="Amount" {...form.register("amount")} error={form.formState.errors.amount?.message as string} />
                <FormCurrencyInput label="Units (opt)" {...form.register("units")} />
                <FormCurrencyInput label="NAV (opt)"   {...form.register("nav")} />
              </div>
              <div className="flex gap-1.5">
                <button type="submit" disabled={isPending}
                  className="flex-1 h-8 rounded-lg text-[11px] font-medium bg-emerald-700 hover:bg-emerald-600 text-white transition-all disabled:opacity-60">
                  {isPending ? "Saving…" : "Add SIP"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="h-8 px-3 rounded-lg text-[11px] text-muted-foreground bg-muted/60 hover:bg-muted transition-all">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors mt-1">
              <Plus className="w-3 h-3" /> Add SIP entry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
