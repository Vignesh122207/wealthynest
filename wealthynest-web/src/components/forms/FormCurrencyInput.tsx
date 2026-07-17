"use client";
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { usePrefsStore, CURRENCIES } from "@/store/preferences.store";

interface FormCurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?:    string;
  error?:    string;
  currency?: string;
}

export const FormCurrencyInput = forwardRef<HTMLInputElement, FormCurrencyInputProps>(
  ({ label, error, currency, className, onChange, id, ...props }, ref) => {
    const { currency: currCode } = usePrefsStore();
    const symbol = currency ?? (CURRENCIES.find(c => c.code === currCode)?.symbol ?? "₹");
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    // type="text" + inputMode="decimal", not type="number": WebKit (Safari/iOS) auto-selects a
    // number input's entire value on focus, making every amount field in the app pre-highlight
    // itself for editing. Digit/dot filtering below replaces what type="number" restricted natively.
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
      if (cleaned !== e.target.value) e.target.value = cleaned;
      onChange?.(e);
    };

    return (
      <div className="space-y-1.5">
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-muted-foreground">{label}</label>}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium select-none">
            {symbol}
          </span>
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            aria-invalid={!!error || undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={handleChange}
            className={cn(
              "w-full h-10 pl-7 pr-3 rounded-xl text-sm transition-all outline-none",
              "bg-background border border-border text-foreground placeholder:text-muted-foreground",
              "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
              className
            )}
            {...props}
          />
        </div>
        {error && <p id={errorId} className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);
FormCurrencyInput.displayName = "FormCurrencyInput";
