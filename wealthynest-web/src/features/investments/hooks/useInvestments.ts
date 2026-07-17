"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QUERY_KEYS } from "@/lib/constants";
import { investmentsApi } from "../api/investments.api";
import type { CreateInvestmentPayload, CreateSipPayload, CreateStockTransactionPayload, InvestmentType } from "../types/investment.types";

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
  qc.invalidateQueries({ queryKey: ["portfolio-xirr"] });
  qc.invalidateQueries({ queryKey: ["type-xirr"] });
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
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: ["income-history"] });
          // Issue #1: refresh dividend suggestions so newly added stock appears immediately
          qc.invalidateQueries({ queryKey: ["dividend-suggestions"] });
        }, 6000);
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

// Money-weighted return across every active investment's combined cashflow timeline — see
// InvestmentServiceImpl.computePortfolioXirr for why this isn't just an average of each
// investment's own XIRR.
export function usePortfolioXirr() {
  return useQuery({
    queryKey: ["portfolio-xirr"],
    queryFn:  investmentsApi.getPortfolioXirr,
    staleTime: 5 * 60 * 1000,
  });
}

// Same money-weighted aggregation as usePortfolioXirr, scoped to one investment type (e.g. every
// active stock's combined cashflow timeline) — see InvestmentServiceImpl.computeTypeXirr.
export function useTypeXirr(type: InvestmentType, enabled = true) {
  return useQuery({
    queryKey: ["type-xirr", type],
    queryFn:  () => investmentsApi.getTypeXirr(type),
    enabled,
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
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      toast.success("Dividend logged to income");
    },
    onError: () => toast.error("Failed to log dividend"),
  });
}

// Dismiss a dividend suggestion (issue #3)
export function useDismissDividend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investmentId, exDate }: { investmentId: string; exDate: string }) =>
      investmentsApi.dismissDividend(investmentId, exDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividend-suggestions"] });
    },
    onError: () => toast.error("Failed to dismiss suggestion"),
  });
}

// Stock transactions — buy more / sell (issues #6, #7)
export function useAddStockTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investmentId, data }: { investmentId: string; data: CreateStockTransactionPayload }) =>
      investmentsApi.addStockTransaction(investmentId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["stock-transactions", vars.investmentId] });
      invalidateAll(qc);
      toast.success("Transaction recorded");
    },
    onError: () => toast.error("Failed to record transaction"),
  });
}

// Only fetched once a stock's history panel is expanded (enabled), not for every card up front.
export function useStockTransactions(investmentId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["stock-transactions", investmentId],
    queryFn: () => investmentsApi.getStockTransactions(investmentId),
    enabled,
  });
}

export function useDeleteStockTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investmentId, txnId }: { investmentId: string; txnId: number }) =>
      investmentsApi.deleteStockTransaction(investmentId, txnId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["stock-transactions", vars.investmentId] });
      invalidateAll(qc);
      toast.success("Transaction removed");
    },
    onError: () => toast.error("Failed to remove transaction"),
  });
}

