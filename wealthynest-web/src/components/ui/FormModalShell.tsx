import {cn} from "@/lib/utils";

interface FormModalShellProps {
  /** Tailwind gradient stop classes for the top accent strip, e.g. "from-fuchsia-500 to-pink-600".
   * Pass "none" to omit the strip entirely — for a caller like Vault whose own header (bled to
   * the card's edges with negative margins) covers that real estate itself; a transparent
   * gradient still occupies the strip's height and leaks the card's own background color above
   * the header instead of actually disappearing. */
  accent: string;
  children: React.ReactNode;
  className?: string;
}

// The "rounded-3xl card + colored top strip + p-5 body" shell every create/edit form modal in
// the app wraps itself in (Budgets, Goals, Debts, Assets, Family…) — previously copy-pasted with
// each page supplying its own accent gradient inline. Still pairs with <TransactionModalOverlay>
// for the backdrop/positioning, which already does that job well on its own.
export function FormModalShell({ accent, children, className }: FormModalShellProps) {
  return (
    <div className={cn("rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card", className)}>
      {accent !== "none" && <div className={cn("h-1.5 bg-gradient-to-r", accent)} />}
      <div className="p-5">{children}</div>
    </div>
  );
}
