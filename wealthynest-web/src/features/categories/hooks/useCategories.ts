"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QUERY_KEYS } from "@/lib/constants";
import { categoriesApi, type CreateCategoryPayload, type UpdateCategoryPayload } from "../api/categories.api";
import type { Category } from "../types/category.types";

export function useCategories(type?: "EXPENSE" | "INCOME" | "TRANSFER") {
  return useQuery({
    queryKey:  [...QUERY_KEYS.CATEGORIES, type],
    queryFn:   () => categoriesApi.getCategories(),
    select:    (data: Category[]) => type ? data.filter((c) => c.type === type) : data,
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCategoryPayload) => categoriesApi.createCategory(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
      toast.success("Category created");
    },
    onError: () => toast.error("Failed to create category"),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCategoryPayload }) =>
      categoriesApi.updateCategory(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
      toast.success("Category updated");
    },
    onError: () => toast.error("Failed to update category"),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
      toast.success("Category deleted");
    },
    onError: () => toast.error("Failed to delete category"),
  });
}
