"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  recurringGoalContributionApi,
  type CreateRecurringGoalContributionPayload,
  type UpdateRecurringGoalContributionPayload,
} from "../api/recurringGoalContribution.api";

const KEY = ["recurring-goal-contribution"] as const;

export function useRecurringGoalContribution() {
  return useQuery({
    queryKey: KEY,
    queryFn:  recurringGoalContributionApi.getAll,
    staleTime: 60_000,
  });
}

export function useCreateRecurringGoalContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRecurringGoalContributionPayload) => recurringGoalContributionApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Auto-contribution rule created");
    },
    onError: () => toast.error("Failed to create rule"),
  });
}

export function useUpdateRecurringGoalContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRecurringGoalContributionPayload }) =>
      recurringGoalContributionApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Rule updated");
    },
    onError: () => toast.error("Failed to update rule"),
  });
}

export function useToggleRecurringGoalContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringGoalContributionApi.toggle(id),
    onSuccess: (rule) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(rule.active ? "Rule activated" : "Rule paused");
    },
    onError: () => toast.error("Failed to toggle rule"),
  });
}

export function useDeleteRecurringGoalContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringGoalContributionApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Rule deleted");
    },
    onError: () => toast.error("Failed to delete rule"),
  });
}
