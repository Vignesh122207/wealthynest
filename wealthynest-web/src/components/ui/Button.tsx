import {type ButtonHTMLAttributes, forwardRef} from "react";
import {cn} from "@/lib/utils";

export type ButtonVariant = "primary" | "gradient" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Shows a spinner before the children and forces `disabled`. Text swap (e.g. "Saving…") stays the caller's call — this only owns the spinner + disabled state. */
  loading?: boolean;
}

// Structural shell shared by every button in the app — height, radius, weight, gap, and
// disabled/loading state. Color is a per-page decision (each feature page deliberately uses a
// different accent), so "gradient"/"danger" callers still supply their own from-/to-/shadow-
// classes via `className`; twMerge lets those win over the variant's own bg-* default.
const VARIANTS: Record<ButtonVariant, string> = {
  // #c2703d (--brand-500) + white text only hit 3.70:1 (WCAG AA needs 4.5:1 for normal text) —
  // brand-600 is the same hue family, one step darker, and clears it at 4.83:1.
  primary:   "bg-[#a85f30] hover:bg-[#c2703d] text-white shadow-lg shadow-[#a85f30]/30 font-semibold",
  gradient:  "text-white shadow-lg font-semibold",
  secondary: "bg-muted hover:bg-muted/80 text-muted-foreground",
  danger:    "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/25 font-semibold",
  ghost:     "bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", loading, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "h-11 px-4 rounded-xl text-sm transition-all inline-flex items-center justify-center gap-2",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        VARIANTS[variant],
        className
      )}
      {...props}
    >
      {loading && <span className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin shrink-0" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
