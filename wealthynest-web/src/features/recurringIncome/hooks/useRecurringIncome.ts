"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  recurringIncomeApi,
  type CreateRecurringIncomePayload,
  type UpdateRecurringIncomePayload,
} from "../api/recurringIncome.api";

const KEY = ["recurring-income"] as const;

export function useRecurringIncome() {
  return useQuery({
    queryKey: KEY,
    queryFn:  recurringIncomeApi.getAll,
    staleTime: 60_000,
  });
}

export function useCreateRecurringIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRecurringIncomePayload) => recurringIncomeApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Auto-credit rule created");
    },
    onError: () => toast.error("Failed to create rule"),
  });
}

export function useUpdateRecurringIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRecurringIncomePayload }) =>
      recurringIncomeApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Rule updated");
    },
    onError: () => toast.error("Failed to update rule"),
  });
}

export function useToggleRecurringIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringIncomeApi.toggle(id),
    onSuccess: (rule) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(rule.active ? "Rule activated" : "Rule paused");
    },
    onError: () => toast.error("Failed to toggle rule"),
  });
}

export function useDeleteRecurringIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringIncomeApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Rule deleted");
    },
    onError: () => toast.error("Failed to delete rule"),
  });
}
