"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QUERY_KEYS } from "@/lib/constants";
import { expensesApi } from "../api/expenses.api";
import type { CreateExpensePayload, ExpenseFilters } from "../types/expense.types";

export function useExpenses(filters: ExpenseFilters = {}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.EXPENSES, filters],
    queryFn:  () => expensesApi.getExpenses(filters),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExpensePayload) => expensesApi.createExpense(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.EXPENSES });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.BUDGETS });
      toast.success("Expense added");
    },
    onError: () => toast.error("Failed to add expense"),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateExpensePayload> }) =>
      expensesApi.updateExpense(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.EXPENSES });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.BUDGETS });
      toast.success("Expense updated");
    },
    onError: () => toast.error("Failed to update expense"),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.EXPENSES });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.BUDGETS });
      toast.success("Expense deleted");
    },
    onError: () => toast.error("Failed to delete expense"),
  });
}
