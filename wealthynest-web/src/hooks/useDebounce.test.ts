import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebounce } from "./useDebounce";

describe("useDebounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("a"));
    expect(result.current).toBe("a");
  });

  it("does not update before the delay elapses", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 400), { initialProps: { value: "a" } });
    rerender({ value: "b" });
    act(() => vi.advanceTimersByTime(399));
    expect(result.current).toBe("a");
  });

  it("updates to the latest value once the delay elapses", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 400), { initialProps: { value: "a" } });
    rerender({ value: "b" });
    act(() => vi.advanceTimersByTime(400));
    expect(result.current).toBe("b");
  });

  it("resets the timer on rapid successive changes (only the last value wins)", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 400), { initialProps: { value: "a" } });
    rerender({ value: "b" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "c" });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("a"); // still not 400ms since the last change
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("c");
  });

  it("uses a default delay of 400ms when none is given", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), { initialProps: { value: "a" } });
    rerender({ value: "b" });
    act(() => vi.advanceTimersByTime(399));
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("b");
  });
});
