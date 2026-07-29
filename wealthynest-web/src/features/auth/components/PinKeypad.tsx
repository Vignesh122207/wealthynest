import {Delete} from "lucide-react";
import {PIN_LENGTH} from "../hooks/usePinEntryFlow";
import {cn} from "@/lib/utils";

// Same cell treatment as AppLockScreen's PIN step — filled/active/error states, shake on
// mismatch — kept separate from that one since AppLockScreen pairs with a hidden native-keyboard
// input, while this pairs with the on-screen Keypad below instead (see pin/page.tsx's original
// comment, preserved by keeping the two apart rather than forcing one shared version on both).
// `compact` is the web popup's smaller sizing (see PinSetupModal) — the native/full-page route has
// a whole viewport to itself and keeps the original size.
export function PinCells({ value, error, compact }: { value: string; error: boolean; compact?: boolean }) {
  return (
    <div className={cn("flex items-center justify-center", compact ? "gap-2" : "gap-2.5", error && "animate-shake")}>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => {
        const filled = i < value.length;
        const active = i === value.length;
        return (
          <div key={i} data-testid="pin-setup-cell" className={cn(
            "w-full rounded-2xl border-[1.5px] flex items-center justify-center transition-all",
            compact ? "max-w-11 h-12" : "max-w-14 h-16",
            error ? "border-red-500 bg-red-500/10"
              : filled ? "border-brand-500 bg-card"
              : active ? "border-brand-300 ring-[3px] ring-brand-500/20"
              : "bg-muted/40 border-border"
          )}>
            {filled && <span className={cn("rounded-full", compact ? "w-2.5 h-2.5" : "w-3 h-3", error ? "bg-red-500" : "bg-brand-500")} />}
          </div>
        );
      })}
    </div>
  );
}

// Custom on-screen keypad — deliberately not the device's native numeric keyboard (the hidden
// `inputMode="numeric"` input Login and App-Lock unlock both still use). This is the one PIN
// entry surface that gets its own input.
export function Keypad({ onDigit, onBackspace, disabled, compact }: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  disabled: boolean;
  compact?: boolean;
}) {
  const keyClass = cn(
    "aspect-square rounded-full border border-border bg-card font-semibold text-foreground",
    compact ? "text-base" : "text-xl",
    "hover:bg-muted active:scale-90 active:bg-brand-500/15 transition-all disabled:opacity-50 disabled:pointer-events-none"
  );

  return (
    <div className={cn("grid grid-cols-3 mx-auto", compact ? "gap-2 max-w-[210px]" : "gap-3.5 max-w-[280px]")}>
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
        <button key={k} type="button" onClick={() => onDigit(k)} disabled={disabled}
          data-testid={`pin-keypad-${k}`} className={keyClass}>
          {k}
        </button>
      ))}
      <div aria-hidden />
      <button type="button" onClick={() => onDigit("0")} disabled={disabled}
        data-testid="pin-keypad-0" className={keyClass}>
        0
      </button>
      <button type="button" onClick={onBackspace} disabled={disabled} aria-label="Delete digit"
        data-testid="pin-keypad-backspace"
        className="aspect-square rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-90 transition-all disabled:opacity-50 disabled:pointer-events-none">
        <Delete className={compact ? "w-4 h-4" : "w-5 h-5"} />
      </button>
    </div>
  );
}
