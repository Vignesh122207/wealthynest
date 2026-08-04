import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTabParam } from "./useTabParam";

const replaceMock = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/things",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

const TABS = ["all", "left", "right"] as const;
type TabId = (typeof TABS)[number];

beforeEach(() => {
  replaceMock.mockClear();
  currentSearch = "";
});

describe("useTabParam", () => {
  it("defaults to defaultTab when the URL has no tab param", () => {
    const { result } = renderHook(() => useTabParam<TabId>(TABS, "all"));
    expect(result.current[0]).toBe("all");
  });

  it("reads the initial tab straight from the URL on first render", () => {
    currentSearch = "tab=right";
    const { result } = renderHook(() => useTabParam<TabId>(TABS, "all"));
    expect(result.current[0]).toBe("right");
  });

  it("falls back to defaultTab for an invalid tab param instead of trusting it", () => {
    currentSearch = "tab=bogus";
    const { result } = renderHook(() => useTabParam<TabId>(TABS, "all"));
    expect(result.current[0]).toBe("all");
  });

  it("updates state and replaces the URL when setTab is called", () => {
    const { result } = renderHook(() => useTabParam<TabId>(TABS, "all"));
    act(() => result.current[1]("left"));
    expect(result.current[0]).toBe("left");
    expect(replaceMock).toHaveBeenCalledWith("/things?tab=left", { scroll: false });
  });

  it("preserves other existing search params when writing the tab back", () => {
    currentSearch = "foo=bar";
    const { result } = renderHook(() => useTabParam<TabId>(TABS, "all"));
    act(() => result.current[1]("right"));
    expect(replaceMock).toHaveBeenCalledWith("/things?foo=bar&tab=right", { scroll: false });
  });

  it("supports a custom param name", () => {
    currentSearch = "section=right";
    const { result } = renderHook(() => useTabParam<TabId>(TABS, "all", "section"));
    expect(result.current[0]).toBe("right");
    act(() => result.current[1]("left"));
    expect(replaceMock).toHaveBeenCalledWith("/things?section=left", { scroll: false });
  });
});
