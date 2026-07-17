import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { CasConfirmRow, CasImportResult, CasPreview } from "../types/casimport.types";

export const casImportApi = {
  preview: async (file: File, password?: string): Promise<CasPreview> => {
    const form = new FormData();
    form.append("file", file);
    if (password) form.append("password", password);
    // Same reasoning as statementImportApi.preview — clear the instance's default JSON
    // Content-Type so the browser sets multipart/form-data WITH the boundary itself.
    return (await apiClient.post<ApiResponse<CasPreview>>("/cas-import/preview", form, {
      headers: { "Content-Type": undefined },
    })).data.data;
  },

  confirm: async (rows: CasConfirmRow[]): Promise<CasImportResult> =>
    (await apiClient.post<ApiResponse<CasImportResult>>("/cas-import/confirm", { rows })).data.data,
};
