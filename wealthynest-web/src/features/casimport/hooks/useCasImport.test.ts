import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { usePreviewCas, useConfirmCasImport } from "./useCasImport";
import { casImportApi } from "../api/casimport.api";

vi.mock("../api/casimport.api", () => ({
  casImportApi: { preview: vi.fn(), confirm: vi.fn() },
}));

const mockedApi = vi.mocked(casImportApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usePreviewCas", () => {
  it("passes the file and password through to the api", async () => {
    mockedApi.preview.mockResolvedValue({ rows: [] } as never);
    const { Wrapper } = createQueryClientWrapper();
    const file = new File(["dummy"], "cas.pdf");

    const { result } = renderHook(() => usePreviewCas(), { wrapper: Wrapper });
    result.current.mutate({ file, password: "secret" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.preview).toHaveBeenCalledWith(file, "secret");
  });
});

describe("useConfirmCasImport", () => {
  it("invalidates INVESTMENTS, NET_WORTH_SUMMARY, and DASHBOARD on success", async () => {
    mockedApi.confirm.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useConfirmCasImport(), { wrapper: Wrapper });
    result.current.mutate([]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.INVESTMENTS });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.NET_WORTH_SUMMARY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.DASHBOARD });
  });

  it("invalidates nothing on failure", async () => {
    mockedApi.confirm.mockRejectedValue(new Error("fail"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useConfirmCasImport(), { wrapper: Wrapper });
    result.current.mutate([]);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
