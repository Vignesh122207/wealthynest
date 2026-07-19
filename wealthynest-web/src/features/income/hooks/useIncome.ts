"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {QUERY_KEYS} from "@/lib/constants";
import {incomeApi} from "../api/income.api";
import type {CreateIncomePayload} from "../types/income.types";

const INCOME_KEY = ["income"];

export function useIncome(year?: number, month?: number, includeDebt?: boolean) {
  return useQuery({
    queryKey: [...INCOME_KEY, year, month, includeDebt],
    queryFn:  () => incomeApi.getIncome(year, month, includeDebt),
  });
}

export function useCreateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateIncomePayload) => incomeApi.createIncome(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INCOME_KEY });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Income recorded");
    },
    onError: () => toast.error("Failed to record income"),
  });
}

export function useUpdateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateIncomePayload> }) =>
      incomeApi.updateIncome(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INCOME_KEY });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Income updated");
    },
    onError: () => toast.error("Failed to update income"),
  });
}

export function useDeleteIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => incomeApi.deleteIncome(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INCOME_KEY });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      toast.success("Income entry deleted");
    },
    onError: () => toast.error("Failed to delete income entry"),
  });
}
