"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QUERY_KEYS } from "@/lib/constants";
import { investmentsApi } from "../api/investments.api";
import type { CreateInvestmentPayload, CreateSipPayload } from "../types/investment.types";

export function useInvestments() {
  return useQuery({ queryKey: QUERY_KEYS.INVESTMENTS, queryFn: investmentsApi.getInvestments });
}

export function useGoldPrice() {
  return useQuery({
    queryKey: [...QUERY_KEYS.INVESTMENTS, "gold-price"],
    queryFn: investmentsApi.getGoldPrice,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useGoldPriceInfo() {
  return useQuery({
    queryKey: [...QUERY_KEYS.INVESTMENTS, "gold-price-info"],
    queryFn: investmentsApi.getGoldPriceInfo,
    staleTime: 60 * 60 * 1000,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QUERY_KEYS.INVESTMENTS });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.ASSETS });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.NET_WORTH_SUMMARY });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
}

export function useCreateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateInvestmentPayload) => investmentsApi.createInvestment(p),
    onSuccess: (_, payload) => {
      invalidateAll(qc);
      // Invalidate income-history after a delay so the async backfill has time to complete
      const backfillTypes = ["STOCK", "BOND", "FD"];
      if (backfillTypes.includes(payload.investmentType)) {
        setTimeout(() => qc.invalidateQueries({ queryKey: ["income-history"] }), 6000);
      }
      toast.success("Investment added");
    },
    onError: () => toast.error("Failed to add investment"),
  });
}

export function useUpdateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateInvestmentPayload }) =>
      investmentsApi.updateInvestment(id, payload),
    onSuccess: () => { invalidateAll(qc); toast.success("Investment updated"); },
    onError:   () => toast.error("Failed to update investment"),
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => investmentsApi.deleteInvestment(id),
    onSuccess: () => { invalidateAll(qc); toast.success("Investment removed"); },
    onError:   () => toast.error("Failed to remove investment"),
  });
}

// Phase 3 — SIP
export function useSipTransactions(investmentId: string | null) {
  return useQuery({
    queryKey: ["sip", investmentId],
    queryFn:  () => investmentsApi.getSipTransactions(investmentId!),
    enabled:  !!investmentId,
  });
}

export function useAddSipTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investmentId, data }: { investmentId: string; data: CreateSipPayload }) =>
      investmentsApi.addSipTransaction({ investmentId, data }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sip", vars.investmentId] });
      qc.invalidateQueries({ queryKey: ["xirr", vars.investmentId] });
      invalidateAll(qc);
      toast.success("SIP entry added");
    },
    onError: () => toast.error("Failed to add SIP entry"),
  });
}

export function useDeleteSipTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investmentId, sipId }: { investmentId: string; sipId: number }) =>
      investmentsApi.deleteSipTransaction(investmentId, sipId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sip", vars.investmentId] });
      qc.invalidateQueries({ queryKey: ["xirr", vars.investmentId] });
      invalidateAll(qc);
      toast.success("SIP entry deleted");
    },
    onError: () => toast.error("Failed to delete SIP entry"),
  });
}

export function useXirr(investmentId: string | null) {
  return useQuery({
    queryKey: ["xirr", investmentId],
    queryFn:  () => investmentsApi.getXirr(investmentId!),
    enabled:  !!investmentId,
    staleTime: 5 * 60 * 1000,
  });
}

// Phase 2 — Dividend suggestions
export function useDividendSuggestions() {
  return useQuery({
    queryKey: ["dividend-suggestions"],
    queryFn:  investmentsApi.getDividendSuggestions,
    staleTime: 60 * 60 * 1000,
  });
}

// Income History
export function useIncomeHistory(year?: number) {
  return useQuery({
    queryKey: ["income-history", year],
    queryFn:  () => investmentsApi.getIncomeHistory(year),
    staleTime: 5 * 60 * 1000,
  });
}

// Manual income logging
export function useLogIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investmentId, data }: {
      investmentId: string;
      data: { incomeType: string; exDate: string; amount: number; perShare?: number; shares?: number };
    }) => investmentsApi.logIncome(investmentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income-history"] });
      qc.invalidateQueries({ queryKey: ["dividend-suggestions"] });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DIVIDENDS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      toast.success("Dividend logged to income");
    },
    onError: () => toast.error("Failed to log dividend"),
  });
}
