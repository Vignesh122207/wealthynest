"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { expenseSplitsApi } from "../api/expensesplits.api";

const KEY = ["expense-splits", "my-splits"];

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
