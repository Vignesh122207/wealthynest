"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/constants";
import { casImportApi } from "../api/casimport.api";
import type { CasConfirmRow } from "../types/casimport.types";

export function usePreviewCas() {
  return useMutation({
    mutationFn: ({ file, password }: { file: File; password?: string }) =>
      casImportApi.preview(file, password),
  });
}

export function useConfirmCasImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: CasConfirmRow[]) => casImportApi.confirm(rows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.INVESTMENTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.NET_WORTH_SUMMARY });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
    },
  });
}
