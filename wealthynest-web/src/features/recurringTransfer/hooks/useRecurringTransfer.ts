"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  recurringTransferApi,
  type CreateRecurringTransferPayload,
  type UpdateRecurringTransferPayload,
} from "../api/recurringTransfer.api";

const KEY = ["recurring-transfer"] as const;

export function useRecurringTransfer() {
  return useQuery({
    queryKey: KEY,
    queryFn:  recurringTransferApi.getAll,
    staleTime: 60_000,
  });
}

export function useCreateRecurringTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRecurringTransferPayload) => recurringTransferApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Auto-transfer rule created");
    },
    onError: () => toast.error("Failed to create rule"),
  });
}

export function useUpdateRecurringTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRecurringTransferPayload }) =>
      recurringTransferApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Rule updated");
    },
    onError: () => toast.error("Failed to update rule"),
  });
}

export function useToggleRecurringTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringTransferApi.toggle(id),
    onSuccess: (rule) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(rule.active ? "Rule activated" : "Rule paused");
    },
    onError: () => toast.error("Failed to toggle rule"),
  });
}

export function useDeleteRecurringTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringTransferApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Rule deleted");
    },
    onError: () => toast.error("Failed to delete rule"),
  });
}
