"use client";

import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {AlertTriangle, Download} from "lucide-react";
import {FormInput} from "@/components/forms/FormInput";
import {Button} from "@/components/ui/Button";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {useExportVault} from "../hooks/useVault";
import {type RevealFormValues, revealSchema} from "../schemas/vault.schema";

const VAULT_SLATE = "#64748b";

type ApiError = { response?: { status?: number; data?: { message?: string } } };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportVaultModal({ onClose }: { onClose: () => void }) {
  const { mutate: exportCsv, isPending, error } = useExportVault();
  const form = useForm<RevealFormValues>({ resolver: zodResolver(revealSchema) });

  const onSubmit = (v: RevealFormValues) => {
    exportCsv({ currentPassword: v.currentPassword }, {
      onSuccess: (blob) => {
        downloadBlob(blob, `wealthynest-vault-export-${new Date().toISOString().slice(0, 10)}.csv`);
        onClose();
      },
    });
  };

  const apiError = error as ApiError | null;
  const errorMessage = apiError?.response?.data?.message
    ?? (error ? "Something went wrong. Please try again." : undefined);

  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-sm">
      <FormModalShell accent="from-[#334155] to-[#64748b]">
        <FormModalHeader icon={Download} hex={VAULT_SLATE} title="Export Vault" onClose={onClose} />
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This file is <strong>not encrypted</strong> — anyone with access to it can read every
              password and note in your vault. Store or delete it carefully after use.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Confirm your account password to export all vault items as CSV.
          </p>
          <FormInput type="password" label="Account Password" placeholder="••••••••" autoFocus
            data-testid="vault-export-password-input" autoComplete="current-password"
            error={form.formState.errors.currentPassword?.message ?? errorMessage}
            {...form.register("currentPassword")} />
          <div className="flex gap-2 pt-1">
            <Button type="submit" variant="gradient" loading={isPending} data-testid="vault-export-submit"
              className="flex-1 bg-gradient-to-r from-[#334155] to-[#64748b] hover:opacity-90 shadow-[#64748b]/25">
              {isPending ? "Exporting…" : "Export CSV"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </FormModalShell>
    </TransactionModalOverlay>
  );
}
