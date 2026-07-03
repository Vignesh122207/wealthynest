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

export function useBudgetsForCategory(categoryId: string | undefined, year: number, month: number) {
  return useQuery({
    queryKey: [...QUERY_KEYS.BUDGETS, "category", categoryId, year, month],
    queryFn:  () => budgetsApi.getBudgetsForCategory(categoryId!, year, month),
    enabled:  !!categoryId,
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

export function useCopyBudgets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fromYear, fromMonth, toYear, toMonth }: {
      fromYear: number; fromMonth: number; toYear: number; toMonth: number;
    }) => budgetsApi.copyBudgets(fromYear, fromMonth, toYear, toMonth),
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.BUDGETS });
      if (count === 0) toast.info("No new budgets to copy — this month already has all categories covered.");
      else toast.success(`Copied ${count} budget${count === 1 ? "" : "s"} from last month`);
    },
    onError: () => toast.error("Failed to copy budgets"),
  });
}
