"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QUERY_KEYS } from "@/lib/constants";
import { budgetsApi } from "../api/budgets.api";
import type { CreateBudgetPayload, UpdateBudgetPayload } from "../types/budget.types";

export function useBudgets(year?: number, month?: number) {
  return useQuery({
    queryKey: [...QUERY_KEYS.BUDGETS, year, month],
    queryFn:  () => budgetsApi.getBudgets(year, month),
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateBudgetPayload) => budgetsApi.createBudget(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.BUDGETS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      toast.success("Budget created");
    },
    onError: () => toast.error("Failed to create budget"),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBudgetPayload }) =>
      budgetsApi.updateBudget(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.BUDGETS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      toast.success("Budget updated");
    },
    onError: () => toast.error("Failed to update budget"),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => budgetsApi.deleteBudget(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.BUDGETS });
      toast.success("Budget deleted");
    },
    onError: () => toast.error("Failed to delete budget"),
  });
}
