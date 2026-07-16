import { cn } from "@/lib/utils";

interface FormModalShellProps {
  /** Tailwind gradient stop classes for the top accent strip, e.g. "from-fuchsia-500 to-pink-600". */
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
      <div className={cn("h-1.5 bg-gradient-to-r", accent)} />
      <div className="p-5">{children}</div>
    </div>
  );
}
