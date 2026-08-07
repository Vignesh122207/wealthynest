"use client";

import {Coins} from "lucide-react";
import {cn} from "@/lib/utils";
import {CONVERTIBLE_CURRENCIES, type ConvertibleCurrency} from "../types/currency.types";
import {useCurrencyRates} from "../hooks/useCurrencyRates";

interface CurrencyToggleProps {
  value: ConvertibleCurrency;
  onChange: (c: ConvertibleCurrency) => void;
}

/** Transactions-page-local currency display toggle — deliberately separate from the app-wide
 * currency preference (preferences.store.ts), which only relabels amounts with a different
 * symbol and never actually converts them. This one does real conversion (useCurrencyRates,
 * backed by live rates), so USD/EUR stay disabled until a rate has actually loaded — never
 * showing a number that only looks converted. */
export function CurrencyToggle({ value, onChange }: CurrencyToggleProps) {
  const { data: rates, isLoading, isError } = useCurrencyRates();

  const isAvailable = (code: ConvertibleCurrency) => code === "INR" || (rates?.rates[code] != null);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center h-9 bg-muted/60 border border-border rounded-xl p-0.5"
        title={isError ? "Live rates unavailable — showing INR only" : undefined}>
        {CONVERTIBLE_CURRENCIES.map(code => {
          const available = isAvailable(code);
          return (
            <button key={code} type="button" onClick={() => available && onChange(code)}
              disabled={!available} data-testid={`currency-toggle-${code}`}
              aria-pressed={value === code}
              className={cn("px-2.5 h-7 rounded-lg text-[11px] font-medium transition-all",
                value === code ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                !available && "opacity-30 cursor-not-allowed hover:text-muted-foreground")}>
              {code}
            </button>
          );
        })}
      </div>
      {isLoading && <Coins className="w-3.5 h-3.5 text-muted-foreground/50 animate-pulse" aria-label="Loading live rates" />}
    </div>
  );
}
