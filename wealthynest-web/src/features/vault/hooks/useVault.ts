"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {QUERY_KEYS} from "@/lib/constants";
import {authApi} from "@/features/auth/api/auth.api";
import {getPasskeyAssertion} from "@/features/auth/utils/webauthn";
import {type StepUpCredential, vaultApi} from "../api/vault.api";
import type {VaultItemPayload} from "../types/vault.types";

export function useVaultItems() {
  return useQuery({ queryKey: QUERY_KEYS.VAULT, queryFn: vaultApi.getItems });
}

export function useVaultHealth() {
  return useQuery({ queryKey: QUERY_KEYS.VAULT_HEALTH, queryFn: vaultApi.getHealth });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QUERY_KEYS.VAULT });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.VAULT_HEALTH });
}

export function useCreateVaultItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: VaultItemPayload) => vaultApi.createItem(p),
    onSuccess: () => { invalidate(qc); toast.success("Item saved to your vault"); },
    onError: () => toast.error("Failed to save item"),
  });
}

export function useUpdateVaultItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: VaultItemPayload }) =>
      vaultApi.updateItem(id, payload),
    onSuccess: () => { invalidate(qc); toast.success("Item updated"); },
    onError: () => toast.error("Failed to update item"),
  });
}

export function useDeleteVaultItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultApi.deleteItem(id),
    onSuccess: () => { invalidate(qc); toast.success("Item deleted"); },
    onError: () => toast.error("Failed to delete item"),
  });
}

export function useToggleVaultFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultApi.toggleFavorite(id),
    onSuccess: () => invalidate(qc),
    onError: () => toast.error("Failed to update favorite"),
  });
}

// No onError toast here — reveal failures (wrong password, lockout) are shown inline in
// RevealSecretModal next to the password field, not as a generic toast.
export function useRevealVaultSecret() {
  return useMutation({
    mutationFn: ({ id, ...stepUp }: { id: string } & StepUpCredential) =>
      vaultApi.revealSecret(id, stepUp),
  });
}

// No onError toast here either — export failures (wrong password, lockout) are shown inline in
// ExportVaultModal, same convention as reveal.
export function useExportVault() {
  return useMutation({
    mutationFn: (stepUp: StepUpCredential) => vaultApi.exportCsv(stepUp),
  });
}

// Runs the passkey ceremony (fetch challenge, prompt the platform authenticator) and hands back
// the raw assertion for RevealSecretModal/ExportVaultModal to submit as the request's
// passkeyCredential — same "fetch options, then getPasskeyAssertion" shape as
// useUnlockWithPasskey, minus that hook's own token issuance since this isn't a login. No onError
// toast: cancelling the OS prompt is a normal outcome (see useRegisterPasskey's own
// NotAllowedError-is-silent convention) and a genuine failure surfaces inline via the modal's
// shared apiErrorMessage, same as a wrong password/PIN.
export function useVaultWebAuthnStepUp() {
  return useMutation({
    mutationFn: async (): Promise<PublicKeyCredentialJSON> => {
      const options = await authApi.getVaultStepUpOptions();
      return getPasskeyAssertion(options);
    },
  });
}
