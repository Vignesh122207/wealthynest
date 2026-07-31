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
  // Same two-stop gradient (brand-600 #a85f30 -> brand-500 #c2703d) already used everywhere else
  // in the app for a primary CTA — LoginForm, SignupForm, ResetPasswordForm, AppLockScreen — this
  // was the one place still flat, standing out as "plain" next to those. The WCAG AA contrast
  // tradeoff this used to guard against with a flat #a85f30 (brand-500 alone only hits 3.70:1
  // against white; brand-600 clears 4.83:1) already exists identically across that whole gradient
  // set, so this isn't introducing a new risk, just matching the pattern already shipped there.
  primary:   "bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5 disabled:hover:translate-y-0 font-semibold",
  gradient:  "text-white shadow-lg font-semibold hover:-translate-y-0.5 disabled:hover:translate-y-0",
  secondary: "bg-muted hover:bg-muted/80 text-muted-foreground",
  danger:    "bg-gradient-to-br from-red-600 to-red-500 text-white shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:-translate-y-0.5 disabled:hover:translate-y-0 font-semibold",
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
