"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {QUERY_KEYS} from "@/lib/constants";
import {apiErrorMessage} from "@/lib/utils";
import {fetchAllPages} from "@/lib/pagination";
import {expensesApi} from "../api/expenses.api";
import type {CreateExpensePayload, ExpenseFilters} from "../types/expense.types";

export function useExpenses(filters: ExpenseFilters = {}, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.EXPENSES, filters],
    queryFn:  () => expensesApi.getExpenses(filters),
    enabled,
  });
}

/** Home/Expenses/Accounts each need every expense ever recorded (for running totals/history), not
 * one page of them — a single oversized `size` request used to cover this until the server-side
 * size cap (added alongside the export flow's own paginated fetch) started rejecting it. Pages
 * through in full via the same fetchAllPages helper the export flow already uses, instead of
 * re-raising the cap that exists specifically to bound query size. */
export function useAllTimeExpenses() {
  return useQuery({
    queryKey: [...QUERY_KEYS.EXPENSES, "all-time"],
    queryFn: () => fetchAllPages(page =>
      expensesApi.getExpenses({ sortDir: "asc", includeDebt: true, page, size: 500 })
    ),
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
      qc.invalidateQueries({ queryKey: ["family-expenses"] });
      toast.success("Expense added");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to add expense")),
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
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to update expense")),
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
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to delete expense")),
  });
}
