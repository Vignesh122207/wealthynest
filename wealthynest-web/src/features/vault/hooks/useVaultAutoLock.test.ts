import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVaultAutoLock } from "./useVaultAutoLock";
import { useVaultTrustStore } from "../store/vaultTrust.store";

beforeEach(() => {
  useVaultTrustStore.setState({ token: null, expiresAt: null, lastActivityAt: null });
});

describe("useVaultAutoLock", () => {
  it("records activity on a window mousemove event while trusted", () => {
    useVaultTrustStore.getState().trust("token-123", 10);
    const activityBefore = useVaultTrustStore.getState().lastActivityAt;

    renderHook(() => useVaultAutoLock());
    window.dispatchEvent(new Event("mousemove"));

    expect(useVaultTrustStore.getState().lastActivityAt).toBeGreaterThanOrEqual(activityBefore!);
  });

  it("is a no-op when nothing is currently trusted", () => {
    renderHook(() => useVaultAutoLock());
    window.dispatchEvent(new Event("keydown"));

    expect(useVaultTrustStore.getState().lastActivityAt).toBeNull();
  });

  it("removes its event listeners on unmount", () => {
    useVaultTrustStore.getState().trust("token-123", 10);
    const { unmount } = renderHook(() => useVaultAutoLock());
    unmount();

    useVaultTrustStore.setState({ lastActivityAt: null });
    window.dispatchEvent(new Event("click"));

    expect(useVaultTrustStore.getState().lastActivityAt).toBeNull();
  });
});
