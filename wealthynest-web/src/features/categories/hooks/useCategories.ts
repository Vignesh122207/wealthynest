"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {QUERY_KEYS} from "@/lib/constants";
import {categoriesApi, type CreateCategoryPayload, type UpdateCategoryPayload} from "../api/categories.api";
import type {Category} from "../types/category.types";

type ApiError = { response?: { status?: number; data?: { message?: string } } };

export function useCategories(type?: "EXPENSE" | "INCOME" | "TRANSFER") {
  return useQuery({
    queryKey:  [...QUERY_KEYS.CATEGORIES, type],
    queryFn:   () => categoriesApi.getCategories(),
    select:    (data: Category[]) => type ? data.filter((c) => c.type === type) : data,
    staleTime: 1000 * 60 * 10,
    // "Manage categories" opens in a separate tab (its own in-memory query cache), so creating
    // a category there can't invalidate this query the normal way — the two tabs never talk to
    // each other. "always" (not the app-wide default of `refetchOnWindowFocus: false`) forces a
    // refetch when the user tabs back here, regardless of the 10min staleTime, so a category
    // added in the other tab actually shows up without a manual page refresh.
    refetchOnWindowFocus: "always",
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
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Failed to create category"),
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
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Failed to update category"),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
      // Deleting a category also deletes its budgets on the backend
      qc.invalidateQueries({ queryKey: QUERY_KEYS.BUDGETS });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
      toast.success("Category deleted");
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.message ?? "Failed to delete category"),
  });
}
