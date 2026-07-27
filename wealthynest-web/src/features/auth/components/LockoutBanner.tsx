"use client";
import {AlertTriangle} from "lucide-react";
import {useCountdown} from "../hooks/useCountdown";

/** Purpose-built state for ACCOUNT_LOCKED/PIN_LOCKED/RATE_LIMIT_EXCEEDED — a live countdown
 * instead of a one-off toast, so a locked-out user knows exactly when they can retry rather than
 * guessing and re-attempting into another lockout. */
export function LockoutBanner({ message, retryAt }: { message: string; retryAt?: string }) {
  const remaining = useCountdown(retryAt);
  return (
    <div data-testid="lockout-banner" className="mb-4 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
      <div className="text-xs text-red-700 dark:text-red-300">
        <p className="font-medium mb-0.5">{message}</p>
        {remaining && <p className="text-red-700/80 dark:text-red-400/80">Try again in {remaining}.</p>}
      </div>
    </div>
  );
}
