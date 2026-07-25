import type {ReactNode} from "react";
import {cn} from "@/lib/utils";

// Elevated card chrome shared by every auth-form step (login's default/PIN/password steps, signup)
// — previously each step's content floated directly on the page background with no depth. Just
// the shell: each step still owns its own header layout (centered icon vs. left-aligned eyebrow).
export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      "relative w-full max-w-md overflow-hidden rounded-[22px] border border-border bg-card",
      "px-8 pb-8 pt-8",
      "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-28px_rgba(0,0,0,0.35)]",
      "animate-fade-in-up",
      className
    )}>
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-600 via-brand-200 to-transparent" />
      {children}
    </div>
  );
}
