"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {QUERY_KEYS} from "@/lib/constants";
import {apiErrorMessage} from "@/lib/utils";
import {type CreateDebtPayload, debtsApi, type RecordPaymentPayload, type UpdateDebtPayload,} from "../api/debts.api";
import type {DebtType} from "../types/debt.types";

const KEY = ["debts"] as const;

const ACCOUNTS_KEY = QUERY_KEYS.ACCOUNTS;

function invalidateBoth(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
  // Debt create/update/payment/delete all create or reverse a DEBT_IN/DEBT_OUT
  // entry in the same feed the Transactions page reads via useExpenses(...,
  // { includeDebt: true }) — without this, that page kept showing stale data
  // until a full reload re-fetched it cold.
  qc.invalidateQueries({ queryKey: QUERY_KEYS.EXPENSES });
}

export function useDebts(type?: DebtType) {
  return useQuery({
    queryKey: type ? [...KEY, type] : KEY,
    queryFn:  () => debtsApi.getAll(type),
    staleTime: 60_000,
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDebtPayload) => debtsApi.create(payload),
    onSuccess: () => { invalidateBoth(qc); toast.success("Debt record added"); },
    onError:   (e: unknown) => toast.error(apiErrorMessage(e, "Failed to add debt")),
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDebtPayload }) =>
      debtsApi.update(id, payload),
    onSuccess: () => { invalidateBoth(qc); toast.success("Debt updated"); },
    onError:   (e: unknown) => toast.error(apiErrorMessage(e, "Failed to update debt")),
  });
}

export function useRecordDebtPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RecordPaymentPayload }) =>
      debtsApi.recordPayment(id, payload),
    onSuccess: () => { invalidateBoth(qc); toast.success("Payment recorded"); },
    onError:   (e: unknown) => toast.error(apiErrorMessage(e, "Failed to record payment")),
  });
}

export function useSettleDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => debtsApi.settle(id),
    onSuccess: () => { invalidateBoth(qc); toast.success("Debt settled"); },
    onError:   (e: unknown) => toast.error(apiErrorMessage(e, "Failed to settle debt")),
  });
}

export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => debtsApi.delete(id),
    onSuccess: () => { invalidateBoth(qc); toast.success("Debt record deleted"); },
    onError:   (e: unknown) => toast.error(apiErrorMessage(e, "Failed to delete debt")),
  });
}
