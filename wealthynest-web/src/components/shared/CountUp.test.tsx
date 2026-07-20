import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { CountUp } from "./CountUp";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let observerCallback: ObserverCallback | null = null;

class MockIntersectionObserver {
  constructor(callback: ObserverCallback) {
    observerCallback = callback;
  }
  observe = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  observerCallback = null;
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

  // rAF jumps the mocked clock well past any `duration`, so the very first frame already resolves
  // progress to 1 — the test only needs to assert the end state, not simulate a real animation.
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    now += 10_000;
    cb(now);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CountUp", () => {
  it("renders 0 before scrolling into view", () => {
    render(<CountUp to={1842600} prefix="₹" />);
    expect(screen.getByText("₹0")).toBeInTheDocument();
  });

  it("counts up to the target with Indian digit grouping once intersecting", () => {
    render(<CountUp to={1842600} prefix="₹" />);
    act(() => observerCallback!([{ isIntersecting: true }]));
    expect(screen.getByText("₹18,42,600")).toBeInTheDocument();
  });

  it("applies decimals and a suffix", () => {
    render(<CountUp to={14.2} decimals={1} prefix="+" suffix="%" />);
    act(() => observerCallback!([{ isIntersecting: true }]));
    expect(screen.getByText("+14.2%")).toBeInTheDocument();
  });

  it("does not animate when the intersection entry isn't intersecting", () => {
    render(<CountUp to={500} />);
    observerCallback!([{ isIntersecting: false }]);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
