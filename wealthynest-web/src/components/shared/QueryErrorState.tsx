import { AlertTriangle } from "lucide-react";
import { EmptyState } from "./EmptyState";

interface QueryErrorStateProps {
  onRetry:      () => void;
  description?: string;
  className?:   string;
}

// Distinct from EmptyState's "genuinely nothing here" look — same shell, red tone, a Retry
// action wired to the query's own refetch. Without this, a failed request and a brand-new
// empty list render identically (see EmptyState), which reads as "you have ₹0" instead of
// "this didn't load".
export function QueryErrorState({
  onRetry,
  description = "Something went wrong loading this. Check your connection and try again.",
  className,
}: QueryErrorStateProps) {
  return (
    <EmptyState
      icon={AlertTriangle}
      tone="red"
      title="Couldn't load this"
      description={description}
      className={className}
      action={
        <button
          onClick={onRetry}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all"
        >
          Retry
        </button>
      }
    />
  );
}
