"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QUERY_KEYS } from "@/lib/constants";
import { accountsApi } from "../api/accounts.api";
import type { CreateAccountPayload, TransferPayload } from "../types/account.types";

function apiMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "response" in e) {
    const data = (e as { response?: { data?: { message?: string } } }).response?.data;
    if (data?.message) return data.message;
  }
  return fallback;
}

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
    onError: (e: unknown) => toast.error(apiMessage(e, "Failed to create account")),
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
    onError: () => toast.error("Failed to update account"),
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
    onError: () => toast.error("Failed to archive account"),
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
    onError: (e: unknown) => toast.error(apiMessage(e, "Failed to restore account")),
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
    onError: () => toast.error("Failed to delete account"),
  });
}

export function useTransfers(page = 0, size = 20) {
  return useQuery({
    queryKey: [...QUERY_KEYS.TRANSFERS, page, size],
    queryFn:  () => accountsApi.getTransfers(page, size),
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
    onError: () => toast.error("Failed to record transfer"),
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
    onError: () => toast.error("Failed to update transfer"),
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
    onError: () => toast.error("Failed to delete transfer"),
  });
}

export function useAdjustBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetBalance }: { id: string; targetBalance: number }) =>
      accountsApi.adjustBalance(id, targetBalance),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      toast.success("Balance adjusted");
    },
    onError: () => toast.error("Failed to adjust balance"),
  });
}
