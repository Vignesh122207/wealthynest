import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useIsDark } from "./useIsDark";
import { useTheme } from "next-themes";

vi.mock("next-themes", () => ({ useTheme: vi.fn() }));
const mockedUseTheme = vi.mocked(useTheme);

describe("useIsDark", () => {
  it("resolves to true after mount when the theme is dark", async () => {
    mockedUseTheme.mockReturnValue({ resolvedTheme: "dark" } as never);
    const { result } = renderHook(() => useIsDark());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("resolves to false after mount when the theme is light", async () => {
    mockedUseTheme.mockReturnValue({ resolvedTheme: "light" } as never);
    const { result } = renderHook(() => useIsDark());
    await waitFor(() => expect(result.current).toBe(false));
  });
});
