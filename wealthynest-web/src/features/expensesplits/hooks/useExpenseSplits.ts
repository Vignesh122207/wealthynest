"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {apiErrorMessage} from "@/lib/utils";
import {expenseSplitsApi} from "../api/expensesplits.api";
import type {SplitParticipantPayload} from "../types/expensesplit.types";

const KEY = ["expense-splits", "my-splits"];
const FOR_EXPENSE_KEY = (expenseId: string) => ["expense-splits", "for-expense", expenseId];

export function useMySplits(enabled: boolean) {
  return useQuery({
    queryKey: KEY,
    queryFn:  expenseSplitsApi.getMySplits,
    enabled,
  });
}

export function useSettleSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expenseSplitsApi.settle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Split settled");
    },
    onError: () => toast.error("Failed to settle split"),
  });
}

export function useSettleWithCounterpart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (counterpartId: string) => expenseSplitsApi.settleWith(counterpartId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("All settled up");
    },
    onError: () => toast.error("Failed to settle up"),
  });
}

/** Splits already on one specific expense — for the Transactions page's detail drawer, distinct
 * from useMySplits' cross-expense balance view. */
export function useExpenseSplitsForExpense(expenseId: string | undefined) {
  return useQuery({
    queryKey: FOR_EXPENSE_KEY(expenseId ?? ""),
    queryFn:  () => expenseSplitsApi.getForExpense(expenseId!),
    enabled:  !!expenseId,
  });
}

export function useAddExpenseSplits(expenseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (splitWith: SplitParticipantPayload[]) => expenseSplitsApi.addToExpense(expenseId!, splitWith),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FOR_EXPENSE_KEY(expenseId ?? "") });
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Split added");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to add split")),
  });
}
