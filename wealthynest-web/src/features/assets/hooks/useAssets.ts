"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {QUERY_KEYS} from "@/lib/constants";
import {assetsApi} from "../api/assets.api";
import type {CreateAssetPayload} from "../types/asset.types";

export function useAssets()   { return useQuery({ queryKey: QUERY_KEYS.ASSETS,    queryFn: assetsApi.getAssets }); }
export function useNetWorth() { return useQuery({ queryKey: QUERY_KEYS.NET_WORTH, queryFn: assetsApi.getNetWorth }); }

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QUERY_KEYS.ASSETS });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.NET_WORTH });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.NET_WORTH_SUMMARY });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.LIABILITIES });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateAssetPayload) => assetsApi.createAsset(p),
    onSuccess: () => { invalidateAll(qc); toast.success("Asset added"); },
    onError: () => toast.error("Failed to add asset"),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateAssetPayload }) =>
      assetsApi.updateAsset(id, payload),
    onSuccess: () => { invalidateAll(qc); toast.success("Asset updated"); },
    onError: () => toast.error("Failed to update asset"),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assetsApi.deleteAsset(id),
    onSuccess: () => { invalidateAll(qc); toast.success("Asset removed"); },
    onError: () => toast.error("Failed to remove asset"),
  });
}
