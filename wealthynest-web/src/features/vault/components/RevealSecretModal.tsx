"use client";

import {useEffect, useRef, useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Check, Copy, Eye, EyeOff} from "lucide-react";
import {toast} from "sonner";
import {FormInput} from "@/components/forms/FormInput";
import {Button} from "@/components/ui/Button";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {resolveVaultIcon} from "@/lib/categoryMeta";
import {useRevealVaultSecret} from "../hooks/useVault";
import {type RevealFormValues, revealSchema} from "../schemas/vault.schema";
import {useVaultTrustStore} from "../store/vaultTrust.store";
import type {VaultItem, VaultItemSecret} from "../types/vault.types";
import {TotpCodeDisplay} from "./TotpCodeDisplay";

type ApiError = { response?: { status?: number; data?: { message?: string } } };

const CLIPBOARD_CLEAR_MS = 20_000;
const TRUST_TTL_MINUTES = 5;
const VAULT_SLATE = "#64748b";

export function RevealSecretModal({ item, accentColor, onClose }: { item: VaultItem; accentColor: string; onClose: () => void }) {
  const [revealed, setRevealed]         = useState<string | null>(null);
  const [revealedTotp, setRevealedTotp] = useState<string | undefined>(undefined);
  const [showSecret, setShowSecret]     = useState(false);
  const [trustDevice, setTrustDevice]   = useState(false);
  const clipboardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { mutate: reveal, isPending, error } = useRevealVaultSecret();

  const trustToken = useVaultTrustStore((s) => s.token);
  const isTrusted  = useVaultTrustStore((s) => s.isTrusted);
  const trust      = useVaultTrustStore((s) => s.trust);
  const clearTrust = useVaultTrustStore((s) => s.clear);
  const [autoRevealPending, setAutoRevealPending] = useState(() => isTrusted());

  const form = useForm<RevealFormValues>({ resolver: zodResolver(revealSchema) });

  useEffect(() => () => { if (clipboardTimer.current) clearTimeout(clipboardTimer.current); }, []);

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
    reveal({ id: item.id, currentPassword: v.currentPassword }, {
      onSuccess: (data) => handleRevealed(data, trustDevice),
    });
  };

  const handleCopy = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed);
    toast.success("Copied — clipboard clears in 20s");
    if (clipboardTimer.current) clearTimeout(clipboardTimer.current);
    clipboardTimer.current = setTimeout(async () => {
      // Only clear if the clipboard still holds what we copied — a user who copied
      // something else in the meantime shouldn't have that wiped out from under them.
      try {
        const current = await navigator.clipboard.readText();
        if (current === revealed) await navigator.clipboard.writeText("");
      } catch {
        // Clipboard read permission denied/unavailable — nothing to safely clear.
      }
    }, CLIPBOARD_CLEAR_MS);
  };

  const apiError = error as ApiError | null;
  const errorMessage = apiError?.response?.data?.message
    ?? (error ? "Something went wrong. Please try again." : undefined);

  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-sm">
      <FormModalShell accent="from-[#334155] to-[#64748b]">
        <FormModalHeader icon={resolveVaultIcon(item)} hex={accentColor} title={item.title} onClose={onClose} />

        {revealed === null ? (
          autoRevealPending ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Unlocking…</div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirm your account password to view this {item.itemType === "LOGIN" ? "password" : "note"}.
              </p>
              <FormInput type="password" label="Account Password" placeholder="••••••••" autoFocus
                data-testid="vault-reveal-password-input" autoComplete="current-password"
                error={form.formState.errors.currentPassword?.message ?? errorMessage}
                {...form.register("currentPassword")} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)}
                  data-testid="vault-trust-device-checkbox" style={{ accentColor: VAULT_SLATE }}
                  className="w-3.5 h-3.5 rounded border-border bg-background cursor-pointer" />
                Trust this device for {TRUST_TTL_MINUTES} minutes
              </label>
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="gradient" loading={isPending} data-testid="vault-reveal-submit"
                  className="flex-1 bg-gradient-to-r from-[#334155] to-[#64748b] hover:opacity-90 shadow-[#64748b]/25">
                  {isPending ? "Verifying…" : "Reveal"}
                </Button>
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              </div>
            </form>
          )
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <div data-testid="vault-revealed-secret" className="w-full min-h-10 px-3 py-2.5 rounded-xl text-sm bg-muted/40 border border-border font-mono break-all pr-10">
                {showSecret ? revealed : "•".repeat(Math.min(revealed.length, 24))}
              </div>
              <button type="button" onClick={() => setShowSecret(v => !v)} aria-label={showSecret ? "Hide" : "Show"}
                className="absolute right-3 top-2.5 text-muted-foreground/60 hover:text-foreground transition-colors">
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {revealedTotp && <TotpCodeDisplay base32Secret={revealedTotp} />}
            <div className="flex gap-2">
              <Button type="button" variant="gradient" onClick={handleCopy}
                className="flex-1 bg-gradient-to-r from-[#334155] to-[#64748b] hover:opacity-90 shadow-[#64748b]/25">
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
