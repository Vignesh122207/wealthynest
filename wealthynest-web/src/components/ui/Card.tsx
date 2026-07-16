import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// The `bg-card border border-border rounded-2xl` shell repeated across every panel/section/
// row-list in the app. Deliberately unopinionated about padding — call sites vary between
// p-4/p-5/p-6 and "no padding + own divide-y rows", so that stays a per-use choice via className.
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("bg-card border border-border rounded-2xl", className)} {...props}>
      {children}
    </div>
  )
);
Card.displayName = "Card";
