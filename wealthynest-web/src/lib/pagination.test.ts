import { describe, it, expect, vi } from "vitest";
import { fetchAllPages } from "./pagination";
import type { PagedResponse } from "@/types/api.types";

function page<T>(data: T[], overrides: Partial<PagedResponse<T>["meta"]> = {}): PagedResponse<T> {
  return {
    success: true, status: 200, data,
    meta: { page: 0, size: data.length, totalElements: data.length, totalPages: 1, first: true, last: true, ...overrides },
    timestamp: "2026-01-01T00:00:00Z",
  };
}

describe("fetchAllPages", () => {
  it("returns everything in a single round trip when the first page is already the last", async () => {
    const fetchPage = vi.fn().mockResolvedValue(page([1, 2, 3], { last: true }));

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0);
  });

  it("follows meta.last across multiple pages instead of stopping at the first, concatenating in order", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(page(["a", "b"], { page: 0, last: false }))
      .mockResolvedValueOnce(page(["c", "d"], { page: 1, last: false }))
      .mockResolvedValueOnce(page(["e"], { page: 2, last: true }));

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual(["a", "b", "c", "d", "e"]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls.map(c => c[0])).toEqual([0, 1, 2]);
  });

  it("stops after a bounded number of pages even if meta.last never comes back true", async () => {
    const fetchPage = vi.fn().mockResolvedValue(page([1], { last: false }));

    const result = await fetchAllPages(fetchPage);

    expect(fetchPage.mock.calls.length).toBeLessThanOrEqual(200);
    expect(result.length).toBe(fetchPage.mock.calls.length);
  });

  it("returns an empty array when the endpoint has no data", async () => {
    const fetchPage = vi.fn().mockResolvedValue(page([], { last: true }));

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
