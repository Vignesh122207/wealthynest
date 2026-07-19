import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { usePreviewStatement, useConfirmImport } from "./useStatementImport";
import { statementImportApi } from "../api/statementimport.api";

vi.mock("../api/statementimport.api", () => ({
  statementImportApi: { preview: vi.fn(), confirm: vi.fn() },
}));

const mockedApi = vi.mocked(statementImportApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usePreviewStatement", () => {
  it("passes the file, mapping, and password through to the api", async () => {
    mockedApi.preview.mockResolvedValue({ rows: [] } as never);
    const { Wrapper } = createQueryClientWrapper();
    const file = new File(["dummy"], "statement.csv");
    const mapping = { date: "Date", amount: "Amount" } as never;

    const { result } = renderHook(() => usePreviewStatement(), { wrapper: Wrapper });
    result.current.mutate({ file, mapping, password: "secret" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.preview).toHaveBeenCalledWith(file, mapping, "secret");
  });
});

describe("useConfirmImport", () => {
  it("invalidates EXPENSES, income, ACCOUNTS, and DASHBOARD on success", async () => {
    mockedApi.confirm.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useConfirmImport(), { wrapper: Wrapper });
    result.current.mutate({ accountId: "a1", rows: [] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.confirm).toHaveBeenCalledWith("a1", []);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.EXPENSES });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["income"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.ACCOUNTS });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.DASHBOARD });
  });

  it("invalidates nothing on failure", async () => {
    mockedApi.confirm.mockRejectedValue(new Error("fail"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useConfirmImport(), { wrapper: Wrapper });
    result.current.mutate({ accountId: "a1", rows: [] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
