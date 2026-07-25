"use client";

import {KeyRound, Lock} from "lucide-react";
import type {UseFormReturn} from "react-hook-form";
import {FormInput} from "@/components/forms/FormInput";
import type {RevealFormValues} from "../schemas/vault.schema";

/** The password-or-PIN step-up field, shared by RevealSecretModal and ExportVaultModal — both
 * gate a sensitive vault action behind the same server-verified credential choice (see
 * VaultServiceImpl's class comment for why native biometric isn't a third option here). `method`
 * lives on the form itself (revealSchema's discriminant) rather than as separate local state, so
 * there's one source of truth for which shape gets validated and submitted. */
export function VaultStepUpFields({ form, pinAvailable, idPrefix, apiErrorMessage }: {
  form: UseFormReturn<RevealFormValues>;
  /** Only accounts with a PIN enabled get the toggle at all — matches how AppLockScreen only
   * offers PIN as an unlock option when `user.pinEnabled` is true. */
  pinAvailable: boolean;
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

  if (method === "pin") {
    return (
      <div>
        <label htmlFor={`${idPrefix}-pin`} className="block text-xs font-bold text-foreground mb-1.5">Account PIN</label>
        <FormInput id={`${idPrefix}-pin`} type="password" inputMode="numeric" maxLength={4} placeholder="••••" autoFocus
          data-testid={`${idPrefix}-pin-input`} autoComplete="off"
          error={errors.pin?.message ?? apiErrorMessage}
          {...form.register("pin")} />
        <button type="button" onClick={() => switchTo("password")}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Lock className="w-3 h-3" /> Use password instead
        </button>
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
      {pinAvailable && (
        <button type="button" onClick={() => switchTo("pin")}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <KeyRound className="w-3 h-3" /> Use PIN instead
        </button>
      )}
    </div>
  );
}
