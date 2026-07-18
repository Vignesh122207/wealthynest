"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {QUERY_KEYS} from "@/lib/constants";
import {goalsApi} from "../api/goals.api";
import type {CreateGoalPayload} from "../types/goal.types";

export function useGoals() {
  return useQuery({
    queryKey:       QUERY_KEYS.GOALS,
    queryFn:        goalsApi.getAll,
    staleTime:      0,
    refetchOnMount: "always",
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGoalPayload) => goalsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Goal created");
    },
    onError: () => toast.error("Failed to create goal"),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateGoalPayload> }) =>
      goalsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Goal updated");
    },
    onError: () => toast.error("Failed to update goal"),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Goal deleted");
    },
    onError: () => toast.error("Failed to delete goal"),
  });
}
