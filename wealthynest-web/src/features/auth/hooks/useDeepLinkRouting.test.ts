import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDeepLinkRouting } from "./useDeepLinkRouting";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));
vi.mock("@capacitor/app", () => ({
  App: {
    getLaunchUrl: vi.fn(() => Promise.resolve(undefined)),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}));

const mockedIsNativePlatform = vi.mocked(Capacitor.isNativePlatform);
const mockedGetLaunchUrl = vi.mocked(App.getLaunchUrl);
const mockedAddListener = vi.mocked(App.addListener);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetLaunchUrl.mockResolvedValue(undefined);
  mockedAddListener.mockResolvedValue({ remove: vi.fn() });
});

describe("useDeepLinkRouting", () => {
  it("does nothing on a non-native platform", async () => {
    mockedIsNativePlatform.mockReturnValue(false);
    renderHook(() => useDeepLinkRouting());

    await new Promise((r) => process.nextTick(r));
    expect(mockedGetLaunchUrl).not.toHaveBeenCalled();
    expect(mockedAddListener).not.toHaveBeenCalled();
  });

  it("navigates to the cold-start launch URL's path and query", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedGetLaunchUrl.mockResolvedValue({ url: "https://www.wealthynest.in/verify-email?token=abc123" });
    renderHook(() => useDeepLinkRouting());

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/verify-email?token=abc123"));
  });

  it("does nothing on cold start when there was no launch URL", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedGetLaunchUrl.mockResolvedValue(undefined);
    renderHook(() => useDeepLinkRouting());

    await waitFor(() => expect(mockedGetLaunchUrl).toHaveBeenCalled());
    await new Promise((r) => process.nextTick(r));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates when a link opens the app while it's already running", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    let openHandler: ((event: { url: string }) => void) | undefined;
    mockedAddListener.mockImplementation((_event, handler) => {
      openHandler = handler as never;
      return Promise.resolve({ remove: vi.fn() });
    });
    renderHook(() => useDeepLinkRouting());

    await waitFor(() => expect(mockedAddListener).toHaveBeenCalled());
    openHandler?.({ url: "https://www.wealthynest.in/reset-password?token=xyz" });
    expect(pushMock).toHaveBeenCalledWith("/reset-password?token=xyz");
  });

  it("ignores a malformed URL instead of throwing", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedGetLaunchUrl.mockResolvedValue({ url: "not-a-url" });
    renderHook(() => useDeepLinkRouting());

    await waitFor(() => expect(mockedGetLaunchUrl).toHaveBeenCalled());
    await new Promise((r) => process.nextTick(r));
    expect(pushMock).not.toHaveBeenCalled();
  });
});
