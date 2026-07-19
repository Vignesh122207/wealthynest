import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAmountFormatter } from "./useAmountFormatter";
import { usePrivacyStore } from "@/store/privacy.store";
import { usePrefsStore } from "@/store/preferences.store";

beforeEach(() => {
  usePrivacyStore.setState({ hideAmounts: false });
  usePrefsStore.setState({ currency: "INR" });
});

describe("useAmountFormatter", () => {
  it("formats a real amount when privacy mode is off", () => {
    const { result } = renderHook(() => useAmountFormatter());
    expect(result.current.fmt(1234)).toContain("1,234");
  });

  it("masks the amount with a fixed-shape placeholder when privacy mode is on", () => {
    usePrivacyStore.setState({ hideAmounts: true });
    const { result } = renderHook(() => useAmountFormatter());
    expect(result.current.fmt(1234)).toBe("₹ ······");
  });

  it("mask never reveals magnitude — a huge amount masks identically to a small one", () => {
    usePrivacyStore.setState({ hideAmounts: true });
    const { result } = renderHook(() => useAmountFormatter());
    expect(result.current.fmt(5)).toBe(result.current.fmt(5_00_00_000));
  });

  it("fmtC uses the shorter compact mask when privacy mode is on", () => {
    usePrivacyStore.setState({ hideAmounts: true });
    const { result } = renderHook(() => useAmountFormatter());
    expect(result.current.fmtC(1234)).toBe("₹ ···");
  });

  it("fmtExact masks the same as fmt when privacy mode is on", () => {
    usePrivacyStore.setState({ hideAmounts: true });
    const { result } = renderHook(() => useAmountFormatter());
    expect(result.current.fmtExact(1234)).toBe("₹ ······");
  });

  it("respects a per-call currency override for the mask symbol", () => {
    usePrivacyStore.setState({ hideAmounts: true });
    const { result } = renderHook(() => useAmountFormatter());
    expect(result.current.fmt(1234, "USD")).toBe("$ ······");
  });

  it("exposes the current hideAmounts flag", () => {
    usePrivacyStore.setState({ hideAmounts: true });
    const { result } = renderHook(() => useAmountFormatter());
    expect(result.current.hideAmounts).toBe(true);
  });
});
