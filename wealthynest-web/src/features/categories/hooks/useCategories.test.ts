import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from "./useCategories";
import { categoriesApi } from "../api/categories.api";
import { toast } from "sonner";
import type { Category } from "../types/category.types";

vi.mock("../api/categories.api", () => ({
  categoriesApi: { getCategories: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), deleteCategory: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(categoriesApi);

const categories: Category[] = [
  { id: "c1", name: "Groceries", type: "EXPENSE", isSystem: true },
  { id: "c2", name: "Salary", type: "INCOME", isSystem: true },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCategories", () => {
  it("returns all categories when no type filter is given", async () => {
    mockedApi.getCategories.mockResolvedValue(categories);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useCategories(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("filters to only the given type client-side", async () => {
    mockedApi.getCategories.mockResolvedValue(categories);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useCategories("EXPENSE"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([categories[0]]);
  });

  // "Manage categories" opens in a separate browser tab, which has its own in-memory query
  // cache — a category created there can't invalidate this query the normal way. Without
  // this, the global default (refetchOnWindowFocus: false) plus the 10min staleTime meant
  // switching back to the original tab never picked up the new category without a manual
  // page refresh.
  it("is configured to always refetch on window focus, overriding the app-wide default", async () => {
    mockedApi.getCategories.mockResolvedValue(categories);
    const { Wrapper, queryClient } = createQueryClientWrapper();

    const { result } = renderHook(() => useCategories("EXPENSE"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = queryClient.getQueryCache().find({ queryKey: [...QUERY_KEYS.CATEGORIES, "EXPENSE"] });
    expect(query?.options.refetchOnWindowFocus).toBe("always");
  });
});

describe("useCreateCategory", () => {
  it("invalidates CATEGORIES and toasts on success", async () => {
    mockedApi.createCategory.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateCategory(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.CATEGORIES });
    expect(toast.success).toHaveBeenCalledWith("Category created");
  });

  it("shows the backend's real error message on failure", async () => {
    mockedApi.createCategory.mockRejectedValue({ response: { data: { message: "Name already exists" } } });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useCreateCategory(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Name already exists");
  });

  it("falls back to a generic message when the error carries none", async () => {
    mockedApi.createCategory.mockRejectedValue({});
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useCreateCategory(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed to create category");
  });
});

describe("useUpdateCategory", () => {
  it("passes id/payload through to the api", async () => {
    mockedApi.updateCategory.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateCategory(), { wrapper: Wrapper });
    result.current.mutate({ id: "c1", payload: { name: "Groceries 2" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.updateCategory).toHaveBeenCalledWith("c1", { name: "Groceries 2" });
    expect(toast.success).toHaveBeenCalledWith("Category updated");
  });
});

describe("useDeleteCategory", () => {
  it("invalidates CATEGORIES, BUDGETS, and DASHBOARD on success (deleting cascades budgets)", async () => {
    mockedApi.deleteCategory.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteCategory(), { wrapper: Wrapper });
    result.current.mutate("c1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.CATEGORIES });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.BUDGETS });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.DASHBOARD });
    expect(toast.success).toHaveBeenCalledWith("Category deleted");
  });
});
