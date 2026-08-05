"use client";

import {useEffect, useRef, useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Check, Copy, Eye, EyeOff, Lock} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/Button";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {resolveVaultIcon} from "@/lib/categoryMeta";
import {cn} from "@/lib/utils";
import {usePasskeys} from "@/features/auth/hooks/useAuth";
import {useWebAuthnSupport} from "@/features/auth/hooks/useWebAuthnSupport";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useRevealVaultSecret, useVaultWebAuthnStepUp} from "../hooks/useVault";
import {type RevealFormValues, revealSchema} from "../schemas/vault.schema";
import {useVaultTrustStore} from "../store/vaultTrust.store";
import type {VaultItem, VaultItemSecret} from "../types/vault.types";
import {TotpCodeDisplay} from "./TotpCodeDisplay";
import {VaultModalHeader} from "./VaultModalHeader";
import {VaultStepUpFields} from "./VaultStepUpFields";

type ApiError = { response?: { status?: number; data?: { message?: string } } };

const CLIPBOARD_CLEAR_MS = 20_000;
const TRUST_TTL_MINUTES = 5;
const IDLE_HIDE_MS = 60_000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll"] as const;
// See VaultHealthCard for the full brass/graphite "vault door" identity this echoes.
const VAULT_BRASS = "#d4a72c";

export function RevealSecretModal({ item, accentColor, onClose }: { item: VaultItem; accentColor: string; onClose: () => void }) {
  const [revealed, setRevealed]         = useState<string | null>(null);
  const [revealedTotp, setRevealedTotp] = useState<string | undefined>(undefined);
  const [showSecret, setShowSecret]     = useState(false);
  const [trustDevice, setTrustDevice]   = useState(false);
  // Bumped on every failed attempt so the password field's wrapper remounts (key change) and
  // replays the shake animation — a plain boolean wouldn't retrigger the CSS animation on
  // back-to-back failures since the class would already be applied from the first one.
  const [shakeKey, setShakeKey]         = useState(0);
  const clipboardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { mutate: reveal, isPending, error } = useRevealVaultSecret();
  const { mutate: assertPasskey, isPending: isAssertingPasskey } = useVaultWebAuthnStepUp();
  const passkeySupported = useWebAuthnSupport();
  const { data: passkeys } = usePasskeys();
  const passkeyAvailable = passkeySupported && !!passkeys?.length;

  const trustToken = useVaultTrustStore((s) => s.token);
  const isTrusted  = useVaultTrustStore((s) => s.isTrusted);
  const trust      = useVaultTrustStore((s) => s.trust);
  const clearTrust = useVaultTrustStore((s) => s.clear);
  const [autoRevealPending, setAutoRevealPending] = useState(() => isTrusted());

  const pinAvailable = !!useAuthStore((s) => s.user?.pinEnabled);
  const form = useForm<RevealFormValues>({
    resolver: zodResolver(revealSchema),
    defaultValues: { method: "password", currentPassword: "" },
  });
  const method = form.watch("method") ?? "password";

  // Deliberately NOT cancelled on unmount — the whole point of this timer is to clear the
  // clipboard after the user is done here, and closing this modal right after copy-pasting (the
  // most common flow) is exactly when it needs to still fire. A plain setTimeout survives the
  // component that scheduled it; only a fresh copy from a still-mounted instance should replace it
  // (handled below), never unmounting.

  const handleRevealed = (data: VaultItemSecret, trustRequested: boolean) => {
    setRevealed(data.secret);
    setRevealedTotp(data.totpSecret);
    if (data.stepUpToken && trustRequested) trust(data.stepUpToken, TRUST_TTL_MINUTES);
  };

  // Already-trusted device (opted in on a previous reveal, still within its window) — skip the
  // password prompt entirely and reveal straight away.
  useEffect(() => {
    if (!autoRevealPending || !trustToken) { setAutoRevealPending(false); return; }
    reveal({ id: item.id, stepUpToken: trustToken }, {
      onSuccess: (data) => { handleRevealed(data, true); setAutoRevealPending(false); },
      onError: () => { clearTrust(); setAutoRevealPending(false); },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (v: RevealFormValues) => {
    reveal({ id: item.id, ...(v.method === "pin" ? { pin: v.pin } : { currentPassword: v.currentPassword }) }, {
      onSuccess: (data) => handleRevealed(data, trustDevice),
      onError: () => setShakeKey((k) => k + 1),
    });
  };

  const handleWebAuthnReveal = () => {
    assertPasskey(undefined, {
      onSuccess: (passkeyCredential) => {
        reveal({ id: item.id, passkeyCredential }, {
          onSuccess: (data) => handleRevealed(data, trustDevice),
          onError: () => setShakeKey((k) => k + 1),
        });
      },
      // Cancelling the OS passkey prompt is a normal outcome (see useRegisterPasskey/
      // useUnlockWithPasskey's own NotAllowedError-is-silent convention). A genuine failure here
      // is the ceremony itself (no options, hardware error) rather than a wrong credential the
      // server rejected, so it toasts instead of shaking the (not currently shown) password field.
      onError: (e: unknown) => {
        if (e instanceof DOMException && e.name === "NotAllowedError") return;
        toast.error("Couldn't confirm with passkey");
      },
    });
  };

  const handleCopy = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed);
    toast.success("Copied — clipboard clears in 20s");
    if (clipboardTimer.current) clearTimeout(clipboardTimer.current);
    clipboardTimer.current = setTimeout(async () => {
      try {
        // Only clear if the clipboard still holds what we copied — a user who copied
        // something else in the meantime shouldn't have that wiped out from under them.
        const current = await navigator.clipboard.readText();
        if (current === revealed) await navigator.clipboard.writeText("");
      } catch {
        // Can't confirm what the clipboard currently holds (read permission denied/unavailable,
        // e.g. Firefox without an explicit grant, or the tab lost focus) — clear it unconditionally
        // rather than silently leaving the secret sitting there. Slightly more aggressive than the
        // happy path (might wipe something else copied in the meantime), but that's the safer
        // failure mode for a password manager's clipboard than never clearing at all.
        try { await navigator.clipboard.writeText(""); } catch { /* Clipboard API entirely unavailable. */ }
      }
    }, CLIPBOARD_CLEAR_MS);
  };

  // Re-masks the revealed secret after a stretch of no mouse/keyboard/scroll activity — an
  // already-open reveal shouldn't keep sensitive plaintext on screen indefinitely if the user
  // walks away, independent of the vault-wide trust/idle-lock (which only governs whether a
  // *future* reveal skips the password prompt, not content already displayed).
  useEffect(() => {
    if (revealed === null) return;
    let lastActivity = Date.now();
    const onActivity = () => { lastActivity = Date.now(); };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const interval = setInterval(() => {
      if (Date.now() - lastActivity >= IDLE_HIDE_MS) setShowSecret(false);
    }, 5000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(interval);
    };
  }, [revealed]);

  const apiError = error as ApiError | null;
  const errorMessage = apiError?.response?.data?.message
    ?? (error ? "Something went wrong. Please try again." : undefined);

  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-sm">
      {/* no accent strip — VaultModalHeader's own banner covers this real estate. */}
      <FormModalShell accent="none">
        <VaultModalHeader icon={resolveVaultIcon(item)} hex={accentColor} title={item.title}
          subtitle={item.itemType === "LOGIN" ? "Reveal password" : "Reveal note"} onClose={onClose} />

        {revealed === null ? (
          autoRevealPending ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Unlocking…</div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirm your account {method === "pin" ? "PIN" : "password"} to view this {item.itemType === "LOGIN" ? "password" : "note"}.
              </p>
              <div key={shakeKey} className={cn(shakeKey > 0 && "animate-shake")}>
                <VaultStepUpFields form={form} pinAvailable={pinAvailable} idPrefix="vault-reveal" apiErrorMessage={errorMessage}
                  passkeyAvailable={passkeyAvailable} passkeyPending={isAssertingPasskey} onUseWebAuthn={handleWebAuthnReveal} />
              </div>
              <label className="flex items-start gap-2.5 text-xs cursor-pointer select-none p-3 rounded-xl"
                style={{ backgroundColor: VAULT_BRASS + "0f", border: `1px solid ${VAULT_BRASS}30` }}>
                <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)}
                  data-testid="vault-trust-device-checkbox" style={{ accentColor: VAULT_BRASS }}
                  className="w-3.5 h-3.5 rounded border-border bg-background cursor-pointer mt-0.5 shrink-0" />
                <span>
                  <span className="block font-semibold text-foreground">Trust this device for {TRUST_TTL_MINUTES} minutes</span>
                  <span className="block text-muted-foreground mt-0.5">Skip this confirmation for other items until then.</span>
                </span>
              </label>
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="gradient" loading={isPending} data-testid="vault-reveal-submit"
                  className="flex-1 bg-gradient-to-br from-[#f6d776] to-[#a9791a] text-[#241705] hover:brightness-105 shadow-lg shadow-[#a9791a]/30">
                  {isPending ? "Verifying…" : "Reveal"}
                </Button>
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              </div>
            </form>
          )
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/60 px-3.5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground mb-1.5">
                {item.itemType === "LOGIN" ? "Password" : "Note"}
              </p>
              <div className="flex items-center justify-between gap-3">
                <div data-testid="vault-revealed-secret" className="text-sm font-mono break-all flex-1 min-w-0">
                  {showSecret ? revealed : "•".repeat(Math.min(revealed.length, 24))}
                </div>
                <button type="button" onClick={() => setShowSecret(v => !v)} aria-label={showSecret ? "Hide" : "Show"}
                  className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors shrink-0">
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {revealedTotp && <TotpCodeDisplay base32Secret={revealedTotp} />}
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="w-3 h-3 shrink-0" /> Copied text clears from your clipboard after 20 seconds.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="gradient" onClick={handleCopy}
                className="flex-1 bg-gradient-to-br from-[#f6d776] to-[#a9791a] text-[#241705] hover:brightness-105 shadow-lg shadow-[#a9791a]/30">
                <Copy className="w-4 h-4" /> Copy
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>
                <Check className="w-4 h-4" /> Done
              </Button>
            </div>
          </div>
        )}
      </FormModalShell>
    </TransactionModalOverlay>
  );
}
