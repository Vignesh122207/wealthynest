import {apiClient} from "@/lib/axios";
import type {ApiResponse} from "@/types/api.types";
import type {Asset, CreateAssetPayload} from "../types/asset.types";

export const assetsApi = {
  getAssets:   async (): Promise<Asset[]>   => (await apiClient.get<ApiResponse<Asset[]>>("/assets")).data.data,
  getNetWorth: async (): Promise<number>    => (await apiClient.get<ApiResponse<number>>("/assets/net-worth")).data.data,
  createAsset: async (p: CreateAssetPayload): Promise<Asset> =>
    (await apiClient.post<ApiResponse<Asset>>("/assets", p)).data.data,
  updateAsset: async (id: string, p: CreateAssetPayload): Promise<Asset> =>
    (await apiClient.put<ApiResponse<Asset>>(`/assets/${id}`, p)).data.data,
  deleteAsset: async (id: string): Promise<void> => { await apiClient.delete(`/assets/${id}`); },
};
