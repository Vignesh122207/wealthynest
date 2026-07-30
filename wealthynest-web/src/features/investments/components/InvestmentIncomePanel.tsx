"use client";

import {useState} from "react";
import {CalendarDays, ChevronDown, ChevronUp} from "lucide-react";
import {cn, formatDate} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import type {IncomeHistoryRecord} from "@/features/investments/types/investment.types";

export function InvestmentIncomePanel({ records, label, accentColor }: {
  records: IncomeHistoryRecord[]; label: string; accentColor: string;
}) {
  const { fmt, fmtExact } = useAmountFormatter();
  const [open, setOpen] = useState(false);
  const total = records.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="mt-2 pt-2 border-t border-border/60">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full text-xs text-muted-foreground/80 hover:text-foreground transition-colors">
        <span className="flex items-center gap-1.5">
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {label} {records.length > 0 ? `(${records.length})` : ""}
        </span>
        {total > 0 && (
          <span className={cn("font-semibold tabular-nums", accentColor)}>+{fmt(total)}</span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-1">
          {records.length === 0 ? (
            <p className="text-xs text-muted-foreground/80 pl-1">
              No {label.toLowerCase()} recorded yet. {label === "Dividends"
                ? "Dividends are fetched automatically from NSE data each evening."
                : "Coupons are calculated and logged automatically on payment dates."}
            </p>
          ) : (
            records.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CalendarDays className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDate(r.eventDate)}</span>
                  {r.perShare != null && (
                    <span className="text-xs text-muted-foreground/80">{fmtExact(Number(r.perShare))}/sh</span>
                  )}
                </div>
                <span className={cn("text-xs font-semibold tabular-nums shrink-0", accentColor)}>
                  +{fmt(r.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
