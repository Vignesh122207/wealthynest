"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/constants";
import { statementImportApi } from "../api/statementimport.api";
import type { ColumnMapping, ConfirmRow } from "../types/statementimport.types";

export function usePreviewStatement() {
  return useMutation({
    mutationFn: ({ file, mapping, password }: { file: File; mapping?: ColumnMapping; password?: string }) =>
      statementImportApi.preview(file, mapping, password),
  });
}

export function useConfirmImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, rows }: { accountId: string; rows: ConfirmRow[] }) =>
      statementImportApi.confirm(accountId, rows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.EXPENSES });
      qc.invalidateQueries({ queryKey: ["income"] });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
    },
  });
}
