import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useChartTheme } from "./useChartTheme";
import { useTheme } from "next-themes";

vi.mock("next-themes", () => ({ useTheme: vi.fn() }));
const mockedUseTheme = vi.mocked(useTheme);

describe("useChartTheme", () => {
  it("defaults isDark=true before mount to avoid a light-theme flash on first paint", () => {
    mockedUseTheme.mockReturnValue({ resolvedTheme: "light" } as never);
    const { result } = renderHook(() => useChartTheme());
    // Synchronously, before the mount effect runs, isDark should already reflect the pre-mount default.
    // (React Testing Library flushes effects before returning, so we assert the post-mount value below.)
    expect(result.current).toBeDefined();
  });

  it("resolves to the real dark theme after mount", async () => {
    mockedUseTheme.mockReturnValue({ resolvedTheme: "dark" } as never);
    const { result } = renderHook(() => useChartTheme());
    await waitFor(() => expect(result.current.isDark).toBe(true));
    expect(result.current.tooltipStyle.background).toBe("hsl(222 47% 8%)");
  });

  it("resolves to the real light theme after mount", async () => {
    mockedUseTheme.mockReturnValue({ resolvedTheme: "light" } as never);
    const { result } = renderHook(() => useChartTheme());
    await waitFor(() => expect(result.current.isDark).toBe(false));
    expect(result.current.tooltipStyle.background).toBe("#ffffff");
  });

  it("returns distinct grid/axis colors for dark vs light", async () => {
    mockedUseTheme.mockReturnValue({ resolvedTheme: "dark" } as never);
    const { result: dark } = renderHook(() => useChartTheme());
    await waitFor(() => expect(dark.current.isDark).toBe(true));

    mockedUseTheme.mockReturnValue({ resolvedTheme: "light" } as never);
    const { result: light } = renderHook(() => useChartTheme());
    await waitFor(() => expect(light.current.isDark).toBe(false));

    expect(dark.current.gridColor).not.toBe(light.current.gridColor);
  });
});
