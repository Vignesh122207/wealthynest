import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { ColumnMapping, ConfirmRow, ImportResult, StatementPreview } from "../types/statementimport.types";

export const statementImportApi = {
  preview: async (file: File, mapping?: ColumnMapping, password?: string): Promise<StatementPreview> => {
    const form = new FormData();
    form.append("file", file);
    if (mapping) form.append("mapping", new Blob([JSON.stringify(mapping)], { type: "application/json" }));
    if (password) form.append("password", password);
    // Instance default Content-Type is application/json — clear it here so the browser can set
    // multipart/form-data WITH the required boundary itself; a hardcoded header has no boundary
    // and the backend's multipart parser rejects the request.
    return (await apiClient.post<ApiResponse<StatementPreview>>("/statement-import/preview", form, {
      headers: { "Content-Type": undefined },
    })).data.data;
  },

  confirm: async (accountId: string, rows: ConfirmRow[]): Promise<ImportResult> =>
    (await apiClient.post<ApiResponse<ImportResult>>("/statement-import/confirm", { accountId, rows })).data.data,
};
