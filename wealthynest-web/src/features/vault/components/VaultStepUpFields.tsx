"use client";

import {Fingerprint, KeyRound, Lock} from "lucide-react";
import type {UseFormReturn} from "react-hook-form";
import {FormInput} from "@/components/forms/FormInput";
import type {RevealFormValues} from "../schemas/vault.schema";

const linkClass = "flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none";

/** The password/PIN/passkey step-up field, shared by RevealSecretModal and ExportVaultModal —
 * both gate a sensitive vault action behind the same server-verified credential choice (see
 * VaultServiceImpl's class comment for why bare native biometric still isn't one of them, unlike
 * a real passkey assertion). Password/PIN's `method` lives on the form itself (revealSchema's
 * discriminant) so there's one source of truth for which shape gets validated and submitted — a
 * passkey deliberately isn't a third branch of that union: the assertion comes from an async
 * browser/OS ceremony, not typed input, so `onUseWebAuthn` runs it directly and the caller submits
 * the result itself, the same "bypass the form" pattern RevealSecretModal's trust-token
 * auto-reveal already uses. */
export function VaultStepUpFields({ form, pinAvailable, passkeyAvailable, passkeyPending, onUseWebAuthn, idPrefix, apiErrorMessage }: {
  form: UseFormReturn<RevealFormValues>;
  /** Only accounts with a PIN enabled get the toggle at all — matches how AppLockScreen only
   * offers PIN as an unlock option when `user.pinEnabled` is true. */
  pinAvailable: boolean;
  /** Only rendered when the account has at least one registered passkey AND this device/browser
   * can actually run a WebAuthn ceremony — same two-part gate as AppLockScreen/SecurityPage use
   * for the passkey option elsewhere (`usePasskeys().data.length` + `useWebAuthnSupport()`). */
  passkeyAvailable?: boolean;
  /** True while the passkey ceremony (challenge fetch + OS prompt) is in flight — disables the
   * button so a second tap can't fire a second concurrent ceremony. */
  passkeyPending?: boolean;
  onUseWebAuthn?: () => void;
  /** Keeps data-testid/id stable but unique between the reveal and export modals. */
  idPrefix: string;
  /** Server-side error (wrong password/PIN, lockout) — shown under whichever field is active. */
  apiErrorMessage?: string;
}) {
  const method = form.watch("method") ?? "password";

  const switchTo = (next: "password" | "pin") => {
    form.reset(next === "pin" ? { method: "pin", pin: "" } : { method: "password", currentPassword: "" });
  };

  // react-hook-form types `errors` against the full discriminated union, not the branch narrowed
  // by `method` above, so TS can't tell `.pin`/`.currentPassword` apart per branch on its own —
  // only one is ever actually populated at runtime, matching whichever branch is currently active.
  const errors = form.formState.errors as Partial<Record<"currentPassword" | "pin", { message?: string }>>;

  const otherOptions = (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {method === "pin" && (
        <button type="button" onClick={() => switchTo("password")} className={linkClass}>
          <Lock className="w-3 h-3" /> Use password instead
        </button>
      )}
      {method === "password" && pinAvailable && (
        <button type="button" onClick={() => switchTo("pin")} className={linkClass}>
          <KeyRound className="w-3 h-3" /> Use PIN instead
        </button>
      )}
      {passkeyAvailable && (
        <button type="button" onClick={onUseWebAuthn} disabled={passkeyPending}
          data-testid={`${idPrefix}-passkey-button`} className={linkClass}>
          <Fingerprint className="w-3 h-3" /> {passkeyPending ? "Confirming…" : "Use passkey instead"}
        </button>
      )}
    </div>
  );

  if (method === "pin") {
    return (
      <div>
        <label htmlFor={`${idPrefix}-pin`} className="block text-xs font-bold text-foreground mb-1.5">Account PIN</label>
        <FormInput id={`${idPrefix}-pin`} type="password" inputMode="numeric" maxLength={4} placeholder="••••" autoFocus
          data-testid={`${idPrefix}-pin-input`} autoComplete="off"
          error={errors.pin?.message ?? apiErrorMessage}
          {...form.register("pin")} />
        {otherOptions}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={`${idPrefix}-password`} className="block text-xs font-bold text-foreground mb-1.5">Account password</label>
      <FormInput id={`${idPrefix}-password`} type="password" placeholder="••••••••" autoFocus
        data-testid={`${idPrefix}-password-input`} autoComplete="current-password"
        error={errors.currentPassword?.message ?? apiErrorMessage}
        {...form.register("currentPassword")} />
      {otherOptions}
    </div>
  );
}
