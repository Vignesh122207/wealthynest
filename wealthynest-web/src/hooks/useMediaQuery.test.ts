import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMediaQuery } from "./useMediaQuery";

class FakeMediaQueryList {
  matches: boolean;
  private listeners: Array<(e: MediaQueryListEvent) => void> = [];
  constructor(matches: boolean) { this.matches = matches; }
  addEventListener(_: string, handler: (e: MediaQueryListEvent) => void) { this.listeners.push(handler); }
  removeEventListener(_: string, handler: (e: MediaQueryListEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== handler);
  }
  emit(matches: boolean) {
    this.matches = matches;
    this.listeners.forEach((l) => l({ matches } as MediaQueryListEvent));
  }
}

let fakeMql: FakeMediaQueryList;

beforeEach(() => {
  fakeMql = new FakeMediaQueryList(false);
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => fakeMql));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("reflects the initial matches value from window.matchMedia", () => {
    fakeMql = new FakeMediaQueryList(true);
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => fakeMql));
    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(result.current).toBe(true);
  });

  it("starts false when the query does not match", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(result.current).toBe(false);
  });

  it("updates when the media query's match state changes", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(result.current).toBe(false);
    act(() => fakeMql.emit(true));
    expect(result.current).toBe(true);
  });

  it("queries window.matchMedia with the given query string", () => {
    const matchMediaSpy = vi.fn().mockImplementation(() => fakeMql);
    vi.stubGlobal("matchMedia", matchMediaSpy);
    renderHook(() => useMediaQuery("(max-width: 640px)"));
    expect(matchMediaSpy).toHaveBeenCalledWith("(max-width: 640px)");
  });
});
