import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountdown } from "./useCountdown";

describe("useCountdown", () => {
  afterEach(() => vi.useRealTimers());

  it("returns null when no target is given", () => {
    const { result } = renderHook(() => useCountdown(undefined));
    expect(result.current).toBeNull();
  });

  it("returns null once the target has already passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { result } = renderHook(() => useCountdown("2025-12-31T23:59:00Z"));
    expect(result.current).toBeNull();
  });

  it("formats minutes and seconds remaining, and ticks down every second", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { result } = renderHook(() => useCountdown("2026-01-01T00:02:05Z"));

    expect(result.current).toBe("2m 5s");

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe("2m 4s");
  });

  it("drops the minutes segment once under a minute remains", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { result } = renderHook(() => useCountdown("2026-01-01T00:00:45Z"));
    expect(result.current).toBe("45s");
  });

  it("becomes null once the countdown reaches zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { result } = renderHook(() => useCountdown("2026-01-01T00:00:02Z"));

    expect(result.current).toBe("2s");
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current).toBeNull();
  });
});
