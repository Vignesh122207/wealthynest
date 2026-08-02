import {apiClient} from "@/lib/axios";
import type {ApiResponse} from "@/types/api.types";
import type {VaultHealthSummary, VaultItem, VaultItemPayload, VaultItemSecret} from "../types/vault.types";

export const vaultApi = {
  getItems: async (): Promise<VaultItem[]> =>
    (await apiClient.get<ApiResponse<VaultItem[]>>("/vault/items")).data.data,
  getHealth: async (): Promise<VaultHealthSummary> =>
    (await apiClient.get<ApiResponse<VaultHealthSummary>>("/vault/health")).data.data,
  createItem: async (p: VaultItemPayload): Promise<VaultItem> =>
    (await apiClient.post<ApiResponse<VaultItem>>("/vault/items", p)).data.data,
  updateItem: async (id: string, p: VaultItemPayload): Promise<VaultItem> =>
    (await apiClient.put<ApiResponse<VaultItem>>(`/vault/items/${id}`, p)).data.data,
  deleteItem: async (id: string): Promise<void> => { await apiClient.delete(`/vault/items/${id}`); },
  toggleFavorite: async (id: string): Promise<VaultItem> =>
    (await apiClient.patch<ApiResponse<VaultItem>>(`/vault/items/${id}/favorite`)).data.data,
  revealSecret: async (id: string, stepUp: StepUpCredential): Promise<VaultItemSecret> =>
    (await apiClient.post<ApiResponse<VaultItemSecret>>(`/vault/items/${id}/reveal`, stepUp)).data.data,
  exportCsv: async (stepUp: StepUpCredential): Promise<Blob> =>
    (await apiClient.post("/vault/export", stepUp, { responseType: "blob" })).data,
};

/** currentPassword, pin, or passkeyCredential (normal step-up, all three server-verified — see
 * VaultServiceImpl), or stepUpToken (an already-trusted device, Phase 5). */
export type StepUpCredential =
  | { currentPassword: string }
  | { pin: string }
  | { passkeyCredential: PublicKeyCredentialJSON }
  | { stepUpToken: string };
