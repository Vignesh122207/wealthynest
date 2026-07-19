"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {QUERY_KEYS} from "@/lib/constants";
import {liabilitiesApi} from "../api/liabilities.api";
import type {CreateLiabilityPayload} from "../types/liability.types";

export function useLiabilities() {
  return useQuery({
    queryKey: QUERY_KEYS.LIABILITIES,
    queryFn:  liabilitiesApi.getAll,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QUERY_KEYS.LIABILITIES });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.ASSETS });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.NET_WORTH });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.NET_WORTH_SUMMARY });
}

export function useCreateLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateLiabilityPayload) => liabilitiesApi.create(p),
    onSuccess: () => { invalidateAll(qc); toast.success("Liability added"); },
    onError: () => toast.error("Failed to add liability"),
  });
}

export function useUpdateLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateLiabilityPayload }) =>
      liabilitiesApi.update(id, payload),
    onSuccess: () => { invalidateAll(qc); toast.success("Liability updated"); },
    onError: () => toast.error("Failed to update liability"),
  });
}

export function useDeleteLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => liabilitiesApi.delete(id),
    onSuccess: () => { invalidateAll(qc); toast.success("Liability removed"); },
    onError: () => toast.error("Failed to remove liability"),
  });
}
