import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useHardwareBackButton } from "./useHardwareBackButton";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

const backMock = vi.fn();
let currentPathname = "/home";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: backMock }),
  usePathname: () => currentPathname,
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
    exitApp: vi.fn(),
  },
}));

const mockedIsNativePlatform = vi.mocked(Capacitor.isNativePlatform);
const mockedAddListener = vi.mocked(App.addListener);
const mockedExitApp = vi.mocked(App.exitApp);

let backButtonHandler: (() => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  currentPathname = "/home";
  mockedAddListener.mockImplementation((_event, handler) => {
    backButtonHandler = handler as never;
    return Promise.resolve({ remove: vi.fn() });
  });
});

describe("useHardwareBackButton", () => {
  it("does nothing on a non-native platform", async () => {
    mockedIsNativePlatform.mockReturnValue(false);
    renderHook(() => useHardwareBackButton());

    await new Promise((r) => process.nextTick(r));
    expect(mockedAddListener).not.toHaveBeenCalled();
  });

  it("exits the app when pressed on /home", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    currentPathname = "/home";
    renderHook(() => useHardwareBackButton());

    await waitFor(() => expect(mockedAddListener).toHaveBeenCalledWith("backButton", expect.any(Function)));
    backButtonHandler?.();

    expect(mockedExitApp).toHaveBeenCalled();
    expect(backMock).not.toHaveBeenCalled();
  });

  it("exits the app when pressed on /login", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    currentPathname = "/login";
    renderHook(() => useHardwareBackButton());

    await waitFor(() => expect(mockedAddListener).toHaveBeenCalled());
    backButtonHandler?.();

    expect(mockedExitApp).toHaveBeenCalled();
  });

  it("exits the app when pressed on /launch (the instant before its own redirect fires)", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    currentPathname = "/launch";
    renderHook(() => useHardwareBackButton());

    await waitFor(() => expect(mockedAddListener).toHaveBeenCalled());
    backButtonHandler?.();

    expect(mockedExitApp).toHaveBeenCalled();
    expect(backMock).not.toHaveBeenCalled();
  });

  it("navigates back instead of exiting from any other route", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    currentPathname = "/settings";
    renderHook(() => useHardwareBackButton());

    await waitFor(() => expect(mockedAddListener).toHaveBeenCalled());
    backButtonHandler?.();

    expect(backMock).toHaveBeenCalled();
    expect(mockedExitApp).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    const removeMock = vi.fn();
    mockedAddListener.mockResolvedValue({ remove: removeMock });
    const { unmount } = renderHook(() => useHardwareBackButton());

    await waitFor(() => expect(mockedAddListener).toHaveBeenCalled());
    unmount();
    await new Promise((r) => process.nextTick(r));

    expect(removeMock).toHaveBeenCalled();
  });
});
