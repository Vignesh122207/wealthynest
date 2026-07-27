import { describe, it, expect, vi, beforeEach } from "vitest";

const { isNativePlatformMock, setOverlaysWebViewMock, setStyleMock } = vi.hoisted(() => ({
  isNativePlatformMock: vi.fn(),
  setOverlaysWebViewMock: vi.fn(),
  setStyleMock: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: isNativePlatformMock },
}));
vi.mock("@capacitor/status-bar", () => ({
  StatusBar: { setOverlaysWebView: setOverlaysWebViewMock, setStyle: setStyleMock },
  Style: { Dark: "DARK", Light: "LIGHT", Default: "DEFAULT" },
}));

import { syncNativeStatusBar } from "./nativeStatusBar";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncNativeStatusBar", () => {
  it("does nothing off a native platform", async () => {
    isNativePlatformMock.mockReturnValue(false);
    await syncNativeStatusBar("dark");
    expect(setOverlaysWebViewMock).not.toHaveBeenCalled();
    expect(setStyleMock).not.toHaveBeenCalled();
  });

  // Style.Dark ("light text for dark backgrounds") must pair with the app's dark theme, and
  // Style.Light ("dark text for light backgrounds") with the light theme — get this backwards
  // and the status bar clock renders dark-on-dark or light-on-light, invisible in both themes.
  it("uses Style.Dark (light icons) for the dark theme", async () => {
    isNativePlatformMock.mockReturnValue(true);
    await syncNativeStatusBar("dark");
    expect(setOverlaysWebViewMock).toHaveBeenCalledWith({ overlay: true });
    expect(setStyleMock).toHaveBeenCalledWith({ style: "DARK" });
  });

  it("uses Style.Light (dark icons) for the light theme", async () => {
    isNativePlatformMock.mockReturnValue(true);
    await syncNativeStatusBar("light");
    expect(setStyleMock).toHaveBeenCalledWith({ style: "LIGHT" });
  });

  it("is best-effort — swallows errors from an unsupported status bar API", async () => {
    isNativePlatformMock.mockReturnValue(true);
    setStyleMock.mockRejectedValueOnce(new Error("unsupported"));
    await expect(syncNativeStatusBar("dark")).resolves.toBeUndefined();
  });
});
