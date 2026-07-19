import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  useVaultItems, useVaultHealth, useCreateVaultItem, useUpdateVaultItem,
  useDeleteVaultItem, useToggleVaultFavorite, useRevealVaultSecret, useExportVault,
} from "./useVault";
import { vaultApi } from "../api/vault.api";
import { toast } from "sonner";

vi.mock("../api/vault.api", () => ({
  vaultApi: {
    getItems: vi.fn(), getHealth: vi.fn(), createItem: vi.fn(), updateItem: vi.fn(),
    deleteItem: vi.fn(), toggleFavorite: vi.fn(), revealSecret: vi.fn(), exportCsv: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(vaultApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useVaultItems / useVaultHealth", () => {
  it("fetches vault items under the VAULT key", async () => {
    mockedApi.getItems.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useVaultItems(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("fetches vault health", async () => {
    mockedApi.getHealth.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useVaultHealth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useCreateVaultItem", () => {
  it("invalidates VAULT and VAULT_HEALTH and toasts on success", async () => {
    mockedApi.createItem.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateVaultItem(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.VAULT });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.VAULT_HEALTH });
    expect(toast.success).toHaveBeenCalledWith("Item saved to your vault");
  });
});

describe("useUpdateVaultItem", () => {
  it("passes id/payload through", async () => {
    mockedApi.updateItem.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateVaultItem(), { wrapper: Wrapper });
    result.current.mutate({ id: "v1", payload: { title: "GitHub" } as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.updateItem).toHaveBeenCalledWith("v1", { title: "GitHub" });
  });
});

describe("useDeleteVaultItem", () => {
  it("invalidates and toasts on success", async () => {
    mockedApi.deleteItem.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteVaultItem(), { wrapper: Wrapper });
    result.current.mutate("v1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Item deleted");
  });
});

describe("useToggleVaultFavorite", () => {
  it("invalidates on success WITHOUT a success toast (deliberately silent)", async () => {
    mockedApi.toggleFavorite.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useToggleVaultFavorite(), { wrapper: Wrapper });
    result.current.mutate("v1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.VAULT });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("toasts an error on failure", async () => {
    mockedApi.toggleFavorite.mockRejectedValue(new Error("fail"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useToggleVaultFavorite(), { wrapper: Wrapper });
    result.current.mutate("v1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed to update favorite");
  });
});

describe("useRevealVaultSecret", () => {
  it("passes id and step-up credential through, with NO toast on failure (shown inline instead)", async () => {
    mockedApi.revealSecret.mockRejectedValue(new Error("wrong password"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useRevealVaultSecret(), { wrapper: Wrapper });
    result.current.mutate({ id: "v1", currentPassword: "hunter2" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedApi.revealSecret).toHaveBeenCalledWith("v1", { currentPassword: "hunter2" });
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("useExportVault", () => {
  it("passes the step-up credential through, with NO toast on failure (shown inline instead)", async () => {
    mockedApi.exportCsv.mockRejectedValue(new Error("wrong password"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useExportVault(), { wrapper: Wrapper });
    result.current.mutate({ currentPassword: "hunter2" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedApi.exportCsv).toHaveBeenCalledWith({ currentPassword: "hunter2" });
    expect(toast.error).not.toHaveBeenCalled();
  });
});
