import {apiErrorCode, apiErrorDetails, apiErrorMessage, apiRetryAfterSeconds} from "@/lib/utils";

export interface LockoutState {
  message: string;
  retryAt?: string;
}

const LOCKOUT_CODES = new Set(["ACCOUNT_LOCKED", "PIN_LOCKED", "RATE_LIMIT_EXCEEDED"]);

/** Recognizes the three "come back later" failure codes (account lockout, PIN lockout, rate
 * limit) and normalizes them to a single {message, retryAt} shape LockoutBanner can render.
 * Everything else returns null so the caller falls back to its normal toast handling — this is
 * deliberately narrow, not a general error classifier. */
export function deriveLockoutState(e: unknown): LockoutState | null {
  const code = apiErrorCode(e);
  if (!code || !LOCKOUT_CODES.has(code)) return null;

  const message = apiErrorMessage(e, "Too many attempts. Please try again later.");
  if (code === "RATE_LIMIT_EXCEEDED") {
    const retryAfterSeconds = apiRetryAfterSeconds(e);
    const retryAt = retryAfterSeconds != null
      ? new Date(Date.now() + retryAfterSeconds * 1000).toISOString()
      : undefined;
    return { message, retryAt };
  }
  return { message, retryAt: apiErrorDetails(e)?.lockedUntil };
}
