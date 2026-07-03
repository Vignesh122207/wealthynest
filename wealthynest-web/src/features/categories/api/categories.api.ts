import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { Category } from "../types/category.types";

export interface CreateCategoryPayload {
  name:   string;
  icon?:  string;
  color?: string;
  type:   "EXPENSE" | "INCOME" | "TRANSFER";
}

export interface UpdateCategoryPayload {
  name?:  string;
  icon?:  string;
  color?: string;
}

export const categoriesApi = {
  getCategories: async (): Promise<Category[]> =>
    (await apiClient.get<ApiResponse<Category[]>>("/categories")).data.data,

  createCategory: async (payload: CreateCategoryPayload): Promise<Category> =>
    (await apiClient.post<ApiResponse<Category>>("/categories", payload)).data.data,

  updateCategory: async (id: string, payload: UpdateCategoryPayload): Promise<Category> =>
    (await apiClient.put<ApiResponse<Category>>(`/categories/${id}`, payload)).data.data,

  deleteCategory: async (id: string): Promise<void> => {
    await apiClient.delete(`/categories/${id}`);
  },
};
