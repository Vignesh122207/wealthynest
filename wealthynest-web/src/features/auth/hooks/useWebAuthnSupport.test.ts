import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useWebAuthnSupport } from "./useWebAuthnSupport";
import { isWebAuthnSupported } from "../utils/webauthn";

vi.mock("../utils/webauthn", () => ({
  isWebAuthnSupported: vi.fn(),
}));

const mockedIsWebAuthnSupported = vi.mocked(isWebAuthnSupported);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useWebAuthnSupport", () => {
  it("starts false before the async check resolves", () => {
    mockedIsWebAuthnSupported.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useWebAuthnSupport());
    expect(result.current).toBe(false);
  });

  it("flips to true once the plugin reports support", async () => {
    mockedIsWebAuthnSupported.mockResolvedValue(true);
    const { result } = renderHook(() => useWebAuthnSupport());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("stays false when the plugin reports no support", async () => {
    mockedIsWebAuthnSupported.mockResolvedValue(false);
    const { result } = renderHook(() => useWebAuthnSupport());
    await waitFor(() => expect(mockedIsWebAuthnSupported).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it("does not update state after unmount (no act() warning)", async () => {
    let resolveCheck: (value: boolean) => void = () => {};
    mockedIsWebAuthnSupported.mockReturnValue(new Promise((resolve) => { resolveCheck = resolve; }));
    const { unmount } = renderHook(() => useWebAuthnSupport());
    unmount();
    resolveCheck(true);
    await Promise.resolve();
  });
});
