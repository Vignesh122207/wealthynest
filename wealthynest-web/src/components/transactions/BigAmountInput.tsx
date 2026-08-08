"use client";

import {useEffect, useRef, useState} from "react";
import {cn} from "@/lib/utils";
import {CurrencyGlyph} from "@/components/icons/CurrencyGlyph";
import {usePrefsStore} from "@/store/preferences.store";

// ─── Shared form chrome — big centered amount, colored header with delete ─────

// Font shrinks as the digit count grows so large amounts (₹1,23,45,678) stay fully visible
// instead of being clipped by a fixed-width input.
function fontClassFor(len: number) {
  if (len <= 4)  return "text-4xl";
  if (len <= 6)  return "text-3xl";
  if (len <= 8)  return "text-2xl";
  if (len <= 10) return "text-xl";
  return "text-lg";
}

export function BigAmountInput({ label = "Amount", error, colorClass, inputProps, testId }: {
  label?: string; error?: string; colorClass: string; inputProps: React.ComponentProps<"input">; testId?: string;
}) {
  const { currency: currCode } = usePrefsStore();
  const localRef = useRef<HTMLInputElement | null>(null);
  const [len, setLen] = useState(1);

  const measure = () => setLen(Math.max(1, localRef.current?.value?.length ?? 1));
  useEffect(() => { measure(); }, []);

  const { ref: rhfRef, onChange: rhfOnChange, onInput: rhfOnInput, ...restInputProps } = inputProps;

  // type="text" + inputMode="decimal", not type="number": WebKit (Safari/iOS) auto-selects a
  // number input's entire value on focus, which read as every amount field in the app
  // pre-highlighting itself for editing. Text avoids that (and the spinner arrows / scroll-to-
  // change-value quirks) while inputMode still brings up the numeric keypad on mobile — digit/dot
  // filtering below replaces what type="number" used to restrict natively.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    if (cleaned !== e.target.value) e.target.value = cleaned;
    rhfOnChange?.(e);
    measure();
  };

  return (
    <div className="text-center py-2">
      <label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-widest">{label}</label>
      {/* gap-0.5 + a `ch`-precise input width (instead of the browser's imprecise `size`
          attribute) keeps the symbol flush against the digits, so the pair reads as one
          unit and recenters together as you type rather than drifting apart. */}
      <div className={cn("flex items-center justify-center gap-0.5 mt-1", colorClass)}>
        <CurrencyGlyph code={currCode} className="h-4 w-auto text-xl font-bold shrink-0" />
        <input type="text" inputMode="decimal" placeholder="0" data-testid={testId}
          ref={(el) => {
            localRef.current = el;
            if (typeof rhfRef === "function") rhfRef(el);
            else if (rhfRef) (rhfRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          }}
          onChange={handleChange}
          onInput={(e) => { rhfOnInput?.(e); measure(); }}
          style={{ width: `${len}ch`, paddingRight: 2 }}
          // big-amount-input: opts this input out of globals.css's mobile-breakpoint
          // `font-size: 16px !important` zoom-prevention floor — every size fontClassFor() picks
          // is already >= 16px by design, so that floor only ever fought this input's own
          // sizing on narrow viewports (including the native app, which is always narrow).
          className={cn(fontClassFor(len), "big-amount-input font-extrabold bg-transparent border-none outline-none text-left max-w-full placeholder:opacity-25 tabular-nums")}
          {...restInputProps} />
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}
