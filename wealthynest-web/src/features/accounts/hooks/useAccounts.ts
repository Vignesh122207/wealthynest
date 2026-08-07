"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {QUERY_KEYS} from "@/lib/constants";
import {apiErrorMessage, formatCurrency} from "@/lib/utils";
import {fetchAllPages} from "@/lib/pagination";
import {accountsApi} from "../api/accounts.api";
import type {CreateAccountPayload, TransferPayload} from "../types/account.types";

export function useAccounts() {
  return useQuery({
    queryKey: QUERY_KEYS.ACCOUNTS,
    queryFn:  accountsApi.getAccounts,
  });
}

export function useArchivedAccounts() {
  return useQuery({
    queryKey: [...QUERY_KEYS.ACCOUNTS, "archived"],
    queryFn:  accountsApi.getArchivedAccounts,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateAccountPayload) => accountsApi.createAccount(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Account created");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to create account")),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateAccountPayload> }) =>
      accountsApi.updateAccount(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Account updated");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to update account")),
  });
}

export function useArchiveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsApi.archiveAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Account archived");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to archive account")),
  });
}

export function useUnarchiveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsApi.unarchiveAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Account restored");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to restore account")),
  });
}

export function useCloseAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsApi.closeAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Account closed");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to close account")),
  });
}

export function useSetPrimaryAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsApi.setPrimary(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      toast.success("Primary account updated");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to set primary account")),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsApi.deleteAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Account deleted");
    },
    // The API only ever 409s here when the account has real history — surface its own message
    // ("close or archive it instead") rather than a generic failure.
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to delete account")),
  });
}

export function useTransfers(page = 0, size = 20) {
  return useQuery({
    queryKey: [...QUERY_KEYS.TRANSFERS, page, size],
    queryFn:  () => accountsApi.getTransfers(page, size),
  });
}

/** Every transfer ever recorded, for callers that need the full history (the Transactions page's
 * running-balance ledger and its "All"/Transfers tabs) rather than one page of it. A single
 * `size=500` request — the server's own @Max cap — silently dropped anything past the 500th
 * transfer once an account had that much history; pages through in full instead, same pattern as
 * useAllTimeExpenses. */
export function useAllTransfers() {
  return useQuery({
    queryKey: [...QUERY_KEYS.TRANSFERS, "all-time"],
    queryFn: () => fetchAllPages(page => accountsApi.getTransfers(page, 500)),
  });
}

export function useTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: TransferPayload) => accountsApi.transfer(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TRANSFERS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Transfer recorded");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to record transfer")),
  });
}

export function useUpdateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { amount?: number; transferDate?: string; description?: string } }) =>
      accountsApi.updateTransfer(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TRANSFERS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Transfer updated");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to update transfer")),
  });
}

export function useDeleteTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsApi.deleteTransfer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TRANSFERS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Transfer deleted");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to delete transfer")),
  });
}

export function useRecordLoanPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, fromAccountId }: { id: string; amount: number; fromAccountId?: string }) =>
      accountsApi.recordLoanPayment(id, amount, fromAccountId),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TRANSFERS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.EXPENSES });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.NET_WORTH_SUMMARY });
      toast.success(r.interestPaid > 0
        ? `Payment recorded — ${formatCurrency(r.principalPaid)} principal, ${formatCurrency(r.interestPaid)} interest`
        : "Payment recorded");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to record payment")),
  });
}

export function useAdjustBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetBalance }: { id: string; targetBalance: number }) =>
      accountsApi.adjustBalance(id, targetBalance),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TRANSFERS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      toast.success("Balance adjusted");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to adjust balance")),
  });
}
