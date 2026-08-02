"use client";

import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {AlertTriangle, Download} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/Button";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {usePasskeys} from "@/features/auth/hooks/useAuth";
import {useWebAuthnSupport} from "@/features/auth/hooks/useWebAuthnSupport";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {downloadBlob} from "@/lib/downloadFile";
import {useExportVault, useVaultWebAuthnStepUp} from "../hooks/useVault";
import {type RevealFormValues, revealSchema} from "../schemas/vault.schema";
import {VaultModalHeader} from "./VaultModalHeader";
import {VaultStepUpFields} from "./VaultStepUpFields";

// See VaultHealthCard for the full brass/graphite "vault door" identity this echoes.
const VAULT_BRASS = "#d4a72c";

type ApiError = { response?: { status?: number; data?: { message?: string } } };

export function ExportVaultModal({ onClose }: { onClose: () => void }) {
  const { mutate: exportCsv, isPending, error } = useExportVault();
  const { mutate: assertPasskey, isPending: isAssertingPasskey } = useVaultWebAuthnStepUp();
  const passkeySupported = useWebAuthnSupport();
  const { data: passkeys } = usePasskeys();
  const passkeyAvailable = passkeySupported && !!passkeys?.length;
  const pinAvailable = !!useAuthStore((s) => s.user?.pinEnabled);
  const form = useForm<RevealFormValues>({
    resolver: zodResolver(revealSchema),
    defaultValues: { method: "password", currentPassword: "" },
  });

  const onSuccessfulExport = (blob: Blob) => {
    downloadBlob(blob, `wealthynest-vault-export-${new Date().toISOString().slice(0, 10)}.csv`);
    onClose();
  };

  const onSubmit = (v: RevealFormValues) => {
    exportCsv(v.method === "pin" ? { pin: v.pin } : { currentPassword: v.currentPassword }, {
      onSuccess: onSuccessfulExport,
    });
  };

  const handleWebAuthnExport = () => {
    assertPasskey(undefined, {
      onSuccess: (passkeyCredential) => exportCsv({ passkeyCredential }, { onSuccess: onSuccessfulExport }),
      // Cancelling the OS passkey prompt is a normal outcome (see RevealSecretModal's own
      // handleWebAuthnReveal) — anything else is the ceremony itself failing, not a credential the
      // server rejected, so it toasts rather than surfacing through the form's inline error.
      onError: (e: unknown) => {
        if (e instanceof DOMException && e.name === "NotAllowedError") return;
        toast.error("Couldn't confirm with passkey");
      },
    });
  };

  const apiError = error as ApiError | null;
  const errorMessage = apiError?.response?.data?.message
    ?? (error ? "Something went wrong. Please try again." : undefined);

  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-sm">
      {/* no accent strip — VaultModalHeader's own banner covers this real estate. */}
      <FormModalShell accent="none">
        <VaultModalHeader icon={Download} hex={VAULT_BRASS} title="Export Vault" subtitle="Download as CSV" onClose={onClose} />
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This file is <strong>not encrypted</strong> — anyone with access to it can read every
              password and note in your vault. Store or delete it carefully after use.
            </p>
          </div>
          <VaultStepUpFields form={form} pinAvailable={pinAvailable} idPrefix="vault-export" apiErrorMessage={errorMessage}
            passkeyAvailable={passkeyAvailable} passkeyPending={isAssertingPasskey} onUseWebAuthn={handleWebAuthnExport} />
          <div className="flex gap-2 pt-1">
            <Button type="submit" variant="gradient" loading={isPending} data-testid="vault-export-submit"
              className="flex-1 bg-gradient-to-br from-[#f6d776] to-[#a9791a] text-[#241705] hover:brightness-105 shadow-lg shadow-[#a9791a]/30">
              {isPending ? "Exporting…" : "Export CSV"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </FormModalShell>
    </TransactionModalOverlay>
  );
}
