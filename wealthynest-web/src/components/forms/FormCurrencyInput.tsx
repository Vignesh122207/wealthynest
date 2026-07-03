"use client";
import { forwardRef, type InputHTMLAttributes, type FocusEvent } from "react";
import { cn } from "@/lib/utils";
import { usePrefsStore, CURRENCIES } from "@/store/preferences.store";

interface FormCurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?:    string;
  error?:    string;
  currency?: string;
}

export const FormCurrencyInput = forwardRef<HTMLInputElement, FormCurrencyInputProps>(
  ({ label, error, currency, className, onFocus, ...props }, ref) => {
    const { currency: currCode } = usePrefsStore();
    const symbol = currency ?? (CURRENCIES.find(c => c.code === currCode)?.symbol ?? "₹");

    const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
      e.target.select();
      onFocus?.(e);
    };

    return (
      <div className="space-y-1.5">
        {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">
            {symbol}
          </span>
          <input
            ref={ref}
            type="number"
            step="0.01"
            min="0"
            onFocus={handleFocus}
            className={cn(
              "w-full h-10 pl-7 pr-3 rounded-xl text-sm transition-all outline-none",
              "bg-slate-800/60 border border-slate-700/60 text-slate-100 placeholder-slate-500",
              "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);
FormCurrencyInput.displayName = "FormCurrencyInput";
